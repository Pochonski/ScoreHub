const { pool } = require('../database/connection');
const db = require('../database/db');

let cachedName = null;
let cacheTime = 0;
let cachedAliases = null;
let aliasesCacheTime = 0;
let cachedSeasons = null;
let seasonsCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getCompetitionName(competitionId) {
  if (cachedName && Date.now() - cacheTime < CACHE_TTL) return cachedName;
  try {
    const rows = await db.execAdvanced('SELECT data FROM competitions WHERE id = $1', [competitionId]);
    if (rows.length) {
      const comps = rows[0].data?.competitions;
      const comp = Array.isArray(comps) ? comps[0] : null;
      if (comp?.name) {
        cachedName = comp.name.toUpperCase();
        cacheTime = Date.now();
        return cachedName;
      }
    }
  } catch (_) {}
  return 'TORNEO';
}

async function getCompetitionAliases(competitionId) {
  if (cachedAliases && Date.now() - aliasesCacheTime < CACHE_TTL) return cachedAliases;
  try {
    const rows = await db.execAdvanced(
      'SELECT alias FROM competition_aliases WHERE competition_id = $1',
      [competitionId]
    );
    const aliases = rows.map(r => r.alias);
    const map = {};
    for (const a of aliases) {
      map[a.toLowerCase()] = competitionId;
    }
    cachedAliases = map;
    aliasesCacheTime = Date.now();
    return map;
  } catch (_) {
    cachedAliases = cachedAliases || {};
    return cachedAliases;
  }
}

async function findCompetitionByAlias(alias) {
  const key = alias.toLowerCase().trim();
  const map = await getCompetitionAliases(parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10));
  if (map[key]) return map[key];
  return null;
}

async function getSeasonLabel(competitionId, seasonNum) {
  if (!cachedSeasons || Date.now() - seasonsCacheTime > CACHE_TTL) {
    try {
      const rows = await db.execAdvanced(
        'SELECT data FROM competition_history WHERE competition_id = $1 ORDER BY (data->>\'seasonNum\')::int ASC',
        [competitionId]
      );
      cachedSeasons = {};
      for (const r of rows) {
        const sn = r.data?.seasonNum;
        const name = r.data?.name || '';
        const yearMatch = name.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
        if (sn != null) {
          cachedSeasons[String(sn)] = yearMatch ? yearMatch[1] : `Ed. ${sn}`;
        }
      }
      seasonsCacheTime = Date.now();
    } catch (_) {
      cachedSeasons = cachedSeasons || {};
    }
  }
  const sn = String(seasonNum);
  if (cachedSeasons[sn]) return cachedSeasons[sn];
  const yearMatch = String(seasonNum).match(/^(\d{4})$/);
  return yearMatch ? yearMatch[1] : `Ed. ${seasonNum}`;
}

function clearCache() {
  cachedName = null;
  cacheTime = 0;
  cachedAliases = null;
  aliasesCacheTime = 0;
  cachedSeasons = null;
  seasonsCacheTime = 0;
}

module.exports = { getCompetitionName, getCompetitionAliases, findCompetitionByAlias, getSeasonLabel, clearCache };
