require('dotenv').config();
const { pool } = require('../database/connection');
const db = require('../database/db');
const mundialCache = require('./mundialCache');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

function stripDiacritics(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeTeamName(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function competitorMatches(competitor, query) {
  if (!competitor || !query) return false;
  const name = stripDiacritics(competitor.name || '');
  const norm = stripDiacritics(normalizeTeamName(query) || query);
  return name.includes(norm) || norm.includes(name);
}

async function getFilteredGames(statusGroups = [1, 2, 4]) {
  const rows = await db.execAdvanced(
    'SELECT data FROM games WHERE competition_id = $1 AND status_group = ANY($2)',
    [COMPETITION_ID, statusGroups]
  );
  return rows.map(r => r.data);
}

async function findGameByTeams(homeQuery, awayQuery) {
  if (!homeQuery || !awayQuery) return null;

  const rows = await db.execAdvanced(
    'SELECT data FROM games WHERE competition_id = $1 AND status_group IN (1, 2, 4)',
    [COMPETITION_ID]
  );
  const games = rows.map(r => r.data);

  const normalize = (s) => stripDiacritics(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  const exactMatches = [];
  const fuzzyMatches = [];
  for (const g of games) {
    const h = normalize(g.homeCompetitor?.name);
    const a = normalize(g.awayCompetitor?.name);
    const hq = normalize(homeQuery);
    const aq = normalize(awayQuery);

    const exactForward = (h.includes(hq) || hq.includes(h)) && (a.includes(aq) || aq.includes(a));
    const exactReverse = (h.includes(aq) || aq.includes(h)) && (a.includes(hq) || hq.includes(a));
    if (exactForward || exactReverse) {
      exactMatches.push(g);
      continue;
    }

    const fuzzyForward = competitorMatches(g.homeCompetitor, homeQuery) && competitorMatches(g.awayCompetitor, awayQuery);
    const fuzzyReverse = competitorMatches(g.homeCompetitor, awayQuery) && competitorMatches(g.awayCompetitor, homeQuery);
    if (fuzzyForward || fuzzyReverse) {
      fuzzyMatches.push(g);
    }
  }

  const candidates = exactMatches.length ? exactMatches : fuzzyMatches;
  if (candidates.length === 0) return null;

  const score = (g) => {
    if (g.statusGroup === 1) return 3;
    if (g.statusGroup === 2) {
      const start = new Date(g.startTime).getTime();
      const now = Date.now();
      const delta = Math.abs(start - now);
      return 2 - Math.min(1, delta / (30 * 86400000));
    }
    return 1;
  };

  candidates.sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    return new Date(b.startTime) - new Date(a.startTime);
  });

  return candidates[0];
}

async function findLiveGames() {
  try {
    const rows = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 1',
      [COMPETITION_ID]
    );
    return rows.map(r => r.data);
  } catch (_) {
    return [];
  }
}

async function findUpcomingGames(limit = 10) {
  try {
    const rows = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 2 ORDER BY start_time ASC LIMIT $2',
      [COMPETITION_ID, limit]
    );
    return rows.map(r => r.data);
  } catch (_) {
    return [];
  }
}

async function findGamesByCompetitorName(name, { limit = 50, statusGroups = [1, 2, 4] } = {}) {
  if (!name) return [];
  const normalized = stripDiacritics(name);
  try {
    const rows = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = ANY($2)',
      [COMPETITION_ID, statusGroups]
    );
    const filtered = rows.filter(r => {
      const home = stripDiacritics(r.data.homeCompetitor?.name || '');
      const away = stripDiacritics(r.data.awayCompetitor?.name || '');
      return home.includes(normalized) || away.includes(normalized);
    }).map(r => r.data);
    return filtered.slice(0, limit);
  } catch (_) {
    return [];
  }
}

module.exports = {
  COMPETITION_ID,
  normalizeTeamName,
  findGameByTeams,
  findLiveGames,
  findUpcomingGames,
  findGamesByCompetitorName,
  competitorMatches,
};
