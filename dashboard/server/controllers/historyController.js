const { pool } = require('../../../database/connection');
const { parseHistoryDoc } = require('../utils/mappers');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

async function getCompetitorMap() {
  const { rows } = await pool.query('SELECT id, name, data FROM competitors');
  const map = {};
  for (const r of rows) {
    map[String(r.id)] = { name: r.name || r.data?.name, imageVersion: r.data?.imageVersion };
  }
  return map;
}

async function fetchHistoryRows() {
  const { rows } = await pool.query('SELECT data FROM competition_history WHERE competition_id = $1', [COMPETITION_ID]);
  if (rows.length) {
    const teamMap = await getCompetitorMap();
    return rows.map(r => {
      const doc = {
        id: `${COMPETITION_ID}-se${r.data.seasonNum}`,
        competitionId: COMPETITION_ID,
        seasonNum: r.data.seasonNum,
        ...r.data,
      };
      return parseHistoryDoc(doc, teamMap);
    });
  }
  // Fallback: derive current season from the competition document.
  const { rows: compRows } = await pool.query(
    "SELECT data->'competitions'->0 as comp FROM competitions WHERE id = $1",
    [COMPETITION_ID]
  );
  const comp = compRows[0]?.comp;
  if (!comp) return [];
  const teamMap = await getCompetitorMap();
  return (comp.seasons || []).map(s => {
    const doc = {
      id: `${COMPETITION_ID}-se${s.num}`,
      competitionId: COMPETITION_ID,
      seasonNum: s.num,
      seasonName: s.name,
      stages: s.stages,
      host: comp.name?.includes('Canada') ? 'Canada/Mexico/USA' : null,
    };
    return parseHistoryDoc(doc, teamMap);
  });
}

async function getHistory(req, res, next) {
  try {
    const data = await fetchHistoryRows();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getHistoryStats(req, res, next) {
  try {
    const teamMap = await getCompetitorMap();
    const parsed = await fetchHistoryRows();

    const titleMap = {};
    const finalMap = {};
    const hosts = [];
    const championsList = [];
    const championNames = [];

    parsed.forEach(e => {
      if (e.entityId) {
        const name = e.champion?.name || String(e.entityId);
        titleMap[name] = (titleMap[name] || 0) + 1;
      }
      if (e.champion) {
        finalMap[e.champion.name] = (finalMap[e.champion.name] || 0) + 1;
        championsList.push({ year: e.year, name: e.champion.name, competitorId: e.champion.competitorId });
        championNames.push(e.champion.name);
      }
      if (e.runnerUp) {
        finalMap[e.runnerUp.name] = (finalMap[e.runnerUp.name] || 0) + 1;
      }
      if (e.host) {
        hosts.push({ country: e.host, year: e.year });
      }
    });

    const sortedByTitles = Object.entries(titleMap).sort((a, b) => b[1] - a[1]);
    const sortedByFinals = Object.entries(finalMap).sort((a, b) => b[1] - a[1]);

    const repeating = [];
    for (let i = 0; i < championNames.length - 1; i++) {
      if (championNames[i] === championNames[i + 1]) {
        const years = parsed.filter(p => p.champion?.name === championNames[i]).map(p => p.year);
        if (!repeating.some(r => r.name === championNames[i])) {
          repeating.push({ name: championNames[i], years });
        }
      }
    }

    res.json({
      totalEditions: parsed.length,
      mostTitles: sortedByTitles[0] ? {
        team: sortedByTitles[0][0],
        count: sortedByTitles[0][1],
        competitorId: parsed.find(p => p.champion?.name === sortedByTitles[0][0])?.champion?.competitorId || null,
      } : null,
      mostFinals: sortedByFinals[0] ? {
        team: sortedByFinals[0][0],
        count: sortedByFinals[0][1],
        competitorId: parsed.find(p => p.champion?.name === sortedByFinals[0][0] || p.runnerUp?.name === sortedByFinals[0][0])
          ?.champion?.competitorId || parsed.find(p => p.runnerUp?.name === sortedByFinals[0][0])?.runnerUp?.competitorId || null,
      } : null,
      hosts,
      champions: championsList,
      repeatingChampions: repeating.map(r => `${r.name} (${r.years.join(', ')})`),
    });
  } catch (err) {
    next(err);
  }
}

async function getHistoryBySeason(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    const { rows } = await pool.query(
      'SELECT data FROM competition_history WHERE competition_id = $1 AND (data->>\'seasonNum\')::int = $2',
      [COMPETITION_ID, seasonNum]
    );
    if (rows.length) {
      const rawDoc = {
        id: `${COMPETITION_ID}-se${rows[0].data.seasonNum}`,
        competitionId: COMPETITION_ID,
        seasonNum: rows[0].data.seasonNum,
        ...rows[0].data,
      };
      const teamMap = await getCompetitorMap();
      const doc = parseHistoryDoc(rawDoc, teamMap);
      return res.json(doc);
    }

    // Fallback to current competition seasons
    const { rows: compRows } = await pool.query(
      "SELECT data->'competitions'->0 as comp FROM competitions WHERE id = $1",
      [COMPETITION_ID]
    );
    const comp = compRows[0]?.comp;
    const season = comp?.seasons?.find(s => s.num === seasonNum);
    if (!season) return res.status(404).json({ error: 'Edición no encontrada' });

    const teamMap = await getCompetitorMap();
    const rawDoc = {
      id: `${COMPETITION_ID}-se${seasonNum}`,
      competitionId: COMPETITION_ID,
      seasonNum,
      seasonName: season.name,
      stages: season.stages,
      host: comp.name?.includes('Canada') ? 'Canada/Mexico/USA' : null,
    };
    const doc = parseHistoryDoc(rawDoc, teamMap);
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function getHistoryMatchStats(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    const { rows } = await pool.query(
      'SELECT data FROM competition_history WHERE competition_id = $1 AND (data->>\'seasonNum\')::int = $2',
      [COMPETITION_ID, seasonNum]
    );
    if (!rows.length) return res.json(null);

    const game = rows[0].data?.group?.games?.[0];
    const gameData = game?.game || game;
    const gameId = gameData?.id || game?.gameId;
    if (!gameId) return res.json(null);

    const { rows: statsRows } = await pool.query('SELECT data FROM game_stats WHERE game_id = $1', [gameId]);
    if (!statsRows.length) return res.json(null);
    res.json(statsRows[0].data);
  } catch (err) {
    next(err);
  }
}

async function getHistoryMatchOverview(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    const { rows } = await pool.query(
      'SELECT data FROM competition_history WHERE competition_id = $1 AND (data->>\'seasonNum\')::int = $2',
      [COMPETITION_ID, seasonNum]
    );
    if (!rows.length) return res.json(null);

    const game = rows[0].data?.group?.games?.[0];
    const gameData = game?.game || game;
    const gameId = gameData?.id || game?.gameId;
    if (!gameId) return res.json(null);

    const { rows: overviewRows } = await pool.query('SELECT data FROM game_overviews WHERE game_id = $1', [gameId]);
    if (!overviewRows.length) return res.json(null);
    res.json(overviewRows[0].data);
  } catch (err) {
    next(err);
  }
}

async function getHistoryDescription(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    const { rows } = await pool.query(
      'SELECT data FROM competition_history WHERE competition_id = $1 AND (data->>\'seasonNum\')::int = $2',
      [COMPETITION_ID, seasonNum]
    );
    if (!rows.length) return res.json([]);

    const doc = rows[0].data;
    const sections = doc?.sections || [];
    const descriptions = sections
      .filter(s => s.type === 'ENTITY_DESCRIPTION')
      .flatMap(s => s.competitorsSeasons?.map(cs => cs.html) || []);
    res.json(descriptions);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHistory,
  getHistoryStats,
  getHistoryBySeason,
  getHistoryMatchStats,
  getHistoryMatchOverview,
  getHistoryDescription,
};
