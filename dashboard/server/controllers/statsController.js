const { pool } = require('../../../database/connection');
const images = require('../../../services/images');
const { resolveCompetition } = require('../utils/competition');

const STAT_TYPE_MAP = { 1: 1, 3: 2, 7: 36 };

async function fetchFromCache(competitionId, seasonNum, statCategoryId) {
  const { rows } = await pool.query(
    'SELECT data FROM tournament_stats WHERE competition_id = $1 AND season_num = $2',
    [competitionId, seasonNum]
  );
  if (!rows.length) return [];

  const tStats = rows[0].data;
  const payload = tStats?.stats?.athletesStats;
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
    const entries = await fetchFromCache(resolved.competitionId, resolved.seasonNum, 1);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTopAssists(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const entries = await fetchFromCache(resolved.competitionId, resolved.seasonNum, 3);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTopRatings(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const entries = await fetchFromCache(resolved.competitionId, resolved.seasonNum, 7);
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
