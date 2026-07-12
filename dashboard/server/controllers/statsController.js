const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));
const scores365 = require(path.join(__dirname, '..', '..', '..', 'services', 'scores365Service'));
const { getCompetitorMap } = require('../services/cacheService');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const COMPETITION_PK = String(MUNDIAL_ID);
const CURRENT_SEASON = parseInt(process.env.SCORES365_SEASON || '25', 10);

async function fetchAthleteStats(statCategoryId, statCategoryName) {
  let payload = null;
  try {
    const doc = await cosmos.getById('tournament_stats', `${MUNDIAL_ID}-se${CURRENT_SEASON}-athletesStats`, COMPETITION_PK);
    payload = doc?.payload;
  } catch { /* ignore */ }

  if (!payload) {
    try {
      const tStats = await scores365.getTournamentStats(MUNDIAL_ID, CURRENT_SEASON);
      payload = tStats?.stats?.athletesStats;
    } catch { /* ignore */ }
  }

  if (!payload) return [];

  const categories = Array.isArray(payload) ? payload : Object.values(payload);
  const cat = categories.find(c => c.id === statCategoryId || c.name === statCategoryName);
  const rows = cat?.rows || [];
  const teamMap = await getCompetitorMap();

  const statTypeMap = { 1: 1, 3: 2, 7: 36 };
  const primaryTypeId = statTypeMap[statCategoryId];

  return rows.slice(0, 10).map(r => {
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
    const entries = await fetchAthleteStats(1, 'Goles');
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTopAssists(req, res, next) {
  try {
    const entries = await fetchAthleteStats(3, 'Asistencias');
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTopRatings(req, res, next) {
  try {
    const entries = await fetchAthleteStats(7, 'Rating 365');
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function getTeamOfWeek(req, res, next) {
  try {
    let tow = null;

    const docs = await cosmos.queryAll('highlights', {
      query: `SELECT * FROM c WHERE c.kind = 'team_of_week' AND c.competitionId = ${MUNDIAL_ID} ORDER BY c._ts DESC`,
    });
    if (docs.length > 0) {
      if (docs[0].teamOfTheWeek?.lineup) {
        tow = { lineup: docs[0].teamOfTheWeek.lineup };
      } else if (docs[0].teamOfWeek) {
        tow = docs[0].teamOfWeek;
      }
    }

    if (!tow) return res.json(null);

    const members = (tow.lineup?.members || []).map(m => ({
      name: m.name,
      position: m.position?.name || m.positionName || '',
      rating: m.ranking,
      photoUrl: (m.athleteId || (m.name && m.id)) ? images.getAthleteThumbUrl(m.athleteId || m.id) : null,
    }));
    res.json({
      formation: tow.lineup?.formation || '4-4-2',
      players: members,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTopScorers, getTopAssists, getTopRatings, getTeamOfWeek };
