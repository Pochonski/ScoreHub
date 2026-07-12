const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const { enrichAthlete, enrichTransferWithTeam } = require('../utils/mappers');
const { getCompetitorMap } = require('../services/cacheService');

async function enrichAthleteTransfers(athlete) {
  if (!athlete?.transfers?.length) return athlete;
  const map = await getCompetitorMap();
  athlete.transfers = athlete.transfers.map(t => enrichTransferWithTeam(t, map));
  return athlete;
}

async function searchAthletes(req, res, next) {
  try {
    const { search, teamId } = req.query;
    let query = `SELECT * FROM c WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND CONTAINS(LOWER(c.name), @search)`;
      params.push({ name: '@search', value: search.toLowerCase() });
    }
    if (teamId) {
      const tid = Number(teamId);
      if (!isNaN(tid)) {
        params.push({ name: '@tid', value: tid });
        query += ' AND c.nationalTeamId = @tid';
      }
    }
    query += ' OFFSET 0 LIMIT 20';

    const athletes = await cosmos.queryAll('athletes', { query, parameters: params });
    res.json(athletes.map(enrichAthlete));
  } catch (err) {
    next(err);
  }
}

async function getAthleteById(req, res, next) {
  try {
    const { id } = req.params;
    const athlete = await cosmos.getById('athletes', String(Number(id)), String(Number(id)));
    if (!athlete) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(await enrichAthleteTransfers(enrichAthlete(athlete)));
  } catch (err) {
    next(err);
  }
}

async function getAthleteCareer(req, res, next) {
  try {
    const { id } = req.params;
    const careers = await cosmos.queryAll('athlete_careers', {
      query: `SELECT * FROM c WHERE c.athleteId = ${Number(id)} ORDER BY c.seasonKey DESC`,
    });
    res.json(careers.map(c => ({
      seasonKey: c.seasonKey,
      name: c.name,
      stats: c.stats,
    })));
  } catch (err) {
    next(err);
  }
}

async function getAthleteTrophies(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await cosmos.getById('athlete_trophies', String(Number(id)), String(Number(id)));
    if (!doc?.categories) return res.json([]);

    res.json(Object.values(doc.categories).map(cat => ({
      name: cat.name,
      trophies: (cat.trophies || []).map(t => ({
        name: t.name,
        count: t.count,
        competitionId: t.competitionId,
      })),
    })));
  } catch (err) {
    next(err);
  }
}

async function getAthleteTransfers(req, res, next) {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    const athlete = await cosmos.getById('athletes', String(numericId), String(numericId));
    const rawTransfers = athlete?.transfers?.length
      ? athlete.transfers
      : await cosmos.queryAll('athlete_transfers', {
          query: `SELECT * FROM c WHERE c.athleteId = ${numericId} ORDER BY c.date DESC`,
        });
    const map = await getCompetitorMap();
    res.json(rawTransfers.map(t => enrichTransferWithTeam({
      date: t.date,
      competitorId: t.competitorId,
      transferTitle: t.transferTitle,
      contractUntil: t.contractUntil,
    }, map)));
  } catch (err) {
    next(err);
  }
}

module.exports = { searchAthletes, getAthleteById, getAthleteCareer, getAthleteTrophies, getAthleteTransfers };
