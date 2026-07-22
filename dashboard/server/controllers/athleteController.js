const { pool } = require('../../../database/connection');
const { enrichAthlete, enrichTransferWithTeam } = require('../utils/mappers');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

async function getCompetitorMap() {
  const { rows } = await pool.query('SELECT id, name, data FROM competitors');
  const map = {};
  for (const r of rows) {
    map[String(r.id)] = { name: r.name || r.data?.name, imageVersion: r.data?.imageVersion };
  }
  return map;
}

async function searchAthletes(req, res, next) {
  try {
    const { search, teamId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      'SELECT data FROM game_overviews WHERE game_id IN (SELECT id FROM games WHERE competition_id = $1)',
      [COMPETITION_ID]
    );

    const seen = new Set();
    const athletes = [];
    for (const r of rows) {
      const game = r.data?.game;
      if (!game) continue;
      for (const team of [game.homeCompetitor, game.awayCompetitor]) {
        if (!team) continue;
        const members = team.members || team.lineups?.members || [];
        for (const m of members) {
          if (m.id && !seen.has(m.id)) {
            seen.add(m.id);
            athletes.push({ ...m, nationalTeamId: team.id, teamId: team.id, competitorId: team.id });
          }
        }
      }
    }

    let filtered = athletes;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(a =>
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.shortName && a.shortName.toLowerCase().includes(q))
      );
    }
    if (teamId) {
      const tid = Number(teamId);
      if (!isNaN(tid)) {
        filtered = filtered.filter(a => a.nationalTeamId === tid || a.teamId === tid || a.competitorId === tid);
      }
    }

    const paged = filtered.slice(offset, offset + limit);
    res.json(paged.map(enrichAthlete));
  } catch (err) {
    next(err);
  }
}

async function getAthleteById(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT data FROM athletes WHERE id = $1', [Number(id)]);
    if (!rows.length) return res.status(404).json({ error: 'Jugador no encontrado' });
    // syncAthletes guarda el miembro del overview directamente en data
    // (data: JSON.stringify(member)), sin envolverlo en { athlete: ... }.
    const athlete = rows[0].data;
    if (!athlete) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(enrichAthlete(athlete));
  } catch (err) {
    next(err);
  }
}

async function getAthleteCareer(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT data FROM athletes WHERE id = $1', [Number(id)]);
    if (!rows.length) return res.json([]);
    const careers = (rows[0].data?.careers || []).map(c => ({
      seasonKey: c.seasonKey,
      name: c.name,
      stats: c.stats,
    }));
    res.json(careers);
  } catch (err) {
    next(err);
  }
}

async function getAthleteTrophies(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT data FROM athletes WHERE id = $1', [Number(id)]);
    if (!rows.length) return res.json([]);
    const doc = rows[0].data?.trophies || rows[0].data?.honours || {};
    const categories = doc.categories || doc;
    if (!categories || typeof categories !== 'object') return res.json([]);
    const trophies = Object.values(categories).map(cat => ({
      name: cat.name,
      trophies: (cat.trophies || []).map(t => ({
        name: t.name,
        count: t.count,
        competitionId: t.competitionId,
      })),
    }));
    res.json(trophies);
  } catch (err) {
    next(err);
  }
}

async function getAthleteTransfers(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT data FROM athletes WHERE id = $1', [Number(id)]);
    if (!rows.length) return res.json([]);
    const rawTransfers = rows[0].data?.transfers || [];
    const map = await getCompetitorMap();
    const transfers = rawTransfers.map(t => enrichTransferWithTeam({
      date: t.date,
      competitorId: t.competitorId,
      transferTitle: t.transferTitle,
      contractUntil: t.contractUntil,
    }, map));
    res.json(transfers);
  } catch (err) {
    next(err);
  }
}

module.exports = { searchAthletes, getAthleteById, getAthleteCareer, getAthleteTrophies, getAthleteTransfers };
