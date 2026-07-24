const { pool } = require('../database/connection');
const db = require('../database/db');
const hardcoded = require('../utils/constants').EQUIPOS_MUNDIAL;

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

let dbTeams = null;
let lastFetch = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function loadTeamsFromDB() {
  if (dbTeams && Date.now() - lastFetch < CACHE_TTL) return dbTeams;
  try {
    const rows = await db.execAdvanced(
      'SELECT id, name, data FROM competitors WHERE competition_id = $1',
      [COMPETITION_ID]
    );
    const map = {};
    for (const r of rows) {
      const name = r.name || (r.data?.name) || '';
      const shortName = r.data?.shortName || '';
      map[name.toLowerCase()] = { id: String(r.id), nombre: name };
      if (shortName && shortName.toLowerCase() !== name.toLowerCase()) {
        map[shortName.toLowerCase()] = { id: String(r.id), nombre: name };
      }
    }
    dbTeams = map;
    lastFetch = Date.now();
  } catch (_) {
    dbTeams = dbTeams || {};
  }
  return dbTeams;
}

async function getTeamId(name) {
  const key = name.toLowerCase().trim();
  const db = await loadTeamsFromDB();
  if (db[key]) return db[key];
  if (hardcoded[key]) return hardcoded[key];
  return null;
}

async function getAllTeams() {
  const db = await loadTeamsFromDB();
  return { ...hardcoded, ...db };
}

function clearCache() {
  dbTeams = null;
  lastFetch = 0;
}

module.exports = { getTeamId, getAllTeams, loadTeamsFromDB, clearCache };
