const db = require('../../../database/db');
const images = require('../../../services/images');
const scores365 = require('../../../services/scores365Service');
const { resolveCompetition } = require('../utils/competition');

const STAT_TYPE_MAP = { 1: 1, 3: 2, 7: 36 };

async function fetchFromCache(competitionId, seasonNum, statCategoryId, startDate, compSeasonNum) {
  if (seasonNum === compSeasonNum && startDate && new Date(startDate) > new Date()) return [];

  // DB-first con write-back (Fase 8.4).
  const { data: row } = await db.readThrough(
    'tournament_stats',
    {
      select: 'data',
      eq: { competition_id: competitionId, season_num: seasonNum },
      maybeSingle: true,
    },
    async () => {
      const live = await scores365.getTournamentStats(competitionId, seasonNum);
      if (!live) return null;
      return {
        competition_id: competitionId,
        season_num: seasonNum,
        data: JSON.stringify(live),
      };
    },
    { onConflict: 'competition_id,season_num', ttlMs: 6 * 60 * 60 * 1000 }, // 6h
  );

  const payload = row?.data?.stats?.athletesStats;
  if (!payload) return [];

  const categories = Array.isArray(payload) ? payload : Object.values(payload);
  const catNames = { 1: 'Goles', 3: 'Asistencias', 7: 'Rating 365' };
  const cat = categories.find(c => c.id === statCategoryId || c.name === catNames[statCategoryId]);
  const rawRows = cat?.rows || [];
  const primaryTypeId = STAT_TYPE_MAP[statCategoryId];

  // Índice slim de competidores (solo id + name). La columna `name` existe
  // en la tabla (migración 004) — NO traer `data` JSONB: eran 1000 filas
  // × JSON completo por request × 3 endpoints (scorers/assists/ratings),
  // uno de los mayores contribuyentes al egress (pausa 2026-09).
  const { data: compRows, error: compErr } = await db.query('competitors', {
    select: 'id, name',
    limit: 1000,
  });
  if (compErr) throw compErr;
  const teamMap = {};
  for (const r of compRows || []) {
    teamMap[String(r.id)] = { name: r.name || '' };
  }

  return rawRows.slice(0, 10).map(r => {
    const stat = primaryTypeId
      ? r.stats?.find(s => s.typeId === primaryTypeId)
      : r.stats?.[0];
    const competitorId = r.entity?.competitorId;
    const teamInfo = competitorId ? teamMap[String(competitorId)] : null;
    return {
      athleteId: r.entity?.id,
      name: r.entity?.name || r.entity?.shortName,
      teamName: teamInfo?.name || '',
      value: Number(stat?.value ?? 0),
      photoUrl: r.entity?.id ? images.getAthletePhotoUrl(r.entity.id) : null,
    };
  });
}

async function getTopScorers(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const seasonNum = req.query.seasonNum
      ? parseInt(req.query.seasonNum, 10)
      : resolved.seasonNum;
    const entries = await fetchFromCache(resolved.competitionId, seasonNum, 1, resolved.comp?.startDate, resolved.seasonNum);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTopAssists(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const seasonNum = req.query.seasonNum
      ? parseInt(req.query.seasonNum, 10)
      : resolved.seasonNum;
    const entries = await fetchFromCache(resolved.competitionId, seasonNum, 3, resolved.comp?.startDate, resolved.seasonNum);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTopRatings(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const seasonNum = req.query.seasonNum
      ? parseInt(req.query.seasonNum, 10)
      : resolved.seasonNum;
    const entries = await fetchFromCache(resolved.competitionId, seasonNum, 7, resolved.comp?.startDate, resolved.seasonNum);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTeamOfWeek(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    const { data, error } = await db.query('team_of_week', {
      select: 'data',
      eq: { competition_id: competitionId },
      maybeSingle: true,
    });
    if (error) throw error;
    if (!data) return res.json(null);

    const raw = data.data;
    const lineup = raw?.teamOfTheWeek?.lineup || raw?.teamOfWeek?.lineup || null;
    if (!lineup?.members?.length) return res.json(null);

    const members = lineup.members.map(m => ({
      athleteId: m.athleteId ?? m.id ?? null,
      name: m.name,
      position: m.position?.name || m.positionName || '',
      rating: m.ranking,
      photoUrl: (m.athleteId || m.id) ? images.getAthleteThumbUrl(m.athleteId || m.id) : null,
    }));
    res.json({ formation: lineup.formation || '4-4-2', players: members });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTopScorers, getTopAssists, getTopRatings, getTeamOfWeek };
