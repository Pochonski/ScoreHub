const { pool } = require('../../../database/connection');
const images = require('../../../services/images');
const scores365 = require('../../../services/scores365Service');
const { resolveCompetition } = require('../utils/competition');

const STAT_TYPE_MAP = { 1: 1, 3: 2, 7: 36 };

async function fetchFromCache(competitionId, seasonNum, statCategoryId, startDate, compSeasonNum) {
  // Solo filtrar si es la temporada activa (compSeasonNum) y no ha empezado.
  // Si el usuario pide una temporada histórica, los datos son válidos.
  if (seasonNum === compSeasonNum && startDate && new Date(startDate) > new Date()) return [];

  const { rows } = await pool.query(
    'SELECT data FROM tournament_stats WHERE competition_id = $1 AND season_num = $2',
    [competitionId, seasonNum]
  );

  let payload;
  if (rows.length) {
    payload = rows[0].data?.stats?.athletesStats;
  } else {
    // Fallback: pedir en vivo si no hay cache para esta temporada.
    try {
      const live = await scores365.getTournamentStats(competitionId, seasonNum);
      payload = live?.stats?.athletesStats;
    } catch (_) { /* fallthrough */ }
  }

  if (!payload) return [];

  const categories = Array.isArray(payload) ? payload : Object.values(payload);
  const catNames = { 1: 'Goles', 3: 'Asistencias', 7: 'Rating 365' };
  const cat = categories.find(c => c.id === statCategoryId || c.name === catNames[statCategoryId]);
  const rawRows = cat?.rows || [];
  const primaryTypeId = STAT_TYPE_MAP[statCategoryId];

  const { rows: compRows } = await pool.query('SELECT id, name, data FROM competitors');
  const teamMap = {};
  for (const r of compRows) {
    teamMap[String(r.id)] = { name: r.data?.name || r.name || '' };
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

    const { rows } = await pool.query('SELECT data FROM team_of_week WHERE competition_id = $1', [competitionId]);
    if (!rows.length) return res.json(null);

    const data = rows[0].data;
    const lineup = data?.teamOfTheWeek?.lineup || data?.teamOfWeek?.lineup || null;
    if (!lineup?.members?.length) return res.json(null);

    const members = lineup.members.map(m => ({
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
