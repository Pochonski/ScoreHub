const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const scores365 = require(path.join(__dirname, '..', '..', '..', 'services', 'scores365Service'));
const { parseHistoryDoc } = require('../utils/mappers');
const { getCompetitorMap } = require('../services/cacheService');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;

let _historyCache = { data: null, expiry: 0 };

async function getHistory(req, res, next) {
  try {
    if (_historyCache.data && Date.now() < _historyCache.expiry) {
      return res.json(_historyCache.data);
    }

    let docs = await cosmos.queryAll('competition_history', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} ORDER BY c.seasonNum DESC`,
    });

    if (docs.length < 20) {
      try {
        const apiData = await scores365.getCompetitionHistory(MUNDIAL_ID);
        const apiRows = apiData?.table?.rows || [];
        if (apiRows.length > 0) {
          const upsertPromises = apiRows.map(r => {
            const doc = {
              id: `${MUNDIAL_ID}-se${r.seasonNum}`,
              competitionId: MUNDIAL_ID,
              seasonNum: r.seasonNum,
              ...r,
              _fetchedAt: new Date().toISOString(),
            };
            return cosmos.upsert('competition_history', doc).catch(() => {});
          });
          await Promise.all(upsertPromises);
          docs = await cosmos.queryAll('competition_history', {
            query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} ORDER BY c.seasonNum DESC`,
          });
        }
      } catch (e) {
        req.log?.warn?.({ err: e.message }, 'Error en fallback 365scores para history');
      }
    }

    const teamMap = await getCompetitorMap();
    const result = docs.map(d => parseHistoryDoc(d, teamMap));

    _historyCache = { data: result, expiry: Date.now() + HISTORY_CACHE_TTL_MS };

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getHistoryStats(req, res, next) {
  try {
    let docs = await cosmos.queryAll('competition_history', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} ORDER BY c.seasonNum ASC`,
    });

    if (docs.length < 20) {
      try {
        const apiData = await scores365.getCompetitionHistory(MUNDIAL_ID);
        const apiRows = apiData?.table?.rows || [];
        if (apiRows.length > 0) {
          const upsertPromises = apiRows.map(r => {
            const doc = {
              id: `${MUNDIAL_ID}-se${r.seasonNum}`,
              competitionId: MUNDIAL_ID,
              seasonNum: r.seasonNum,
              ...r,
              _fetchedAt: new Date().toISOString(),
            };
            return cosmos.upsert('competition_history', doc).catch(() => {});
          });
          await Promise.all(upsertPromises);
          docs = await cosmos.queryAll('competition_history', {
            query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} ORDER BY c.seasonNum ASC`,
          });
        }
      } catch (e) {
        req.log?.warn?.({ err: e.message }, 'Error en fallback 365scores para history stats');
      }
    }

    const teamMap = await getCompetitorMap();
    const parsed = docs.map(d => parseHistoryDoc(d, teamMap));

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

    let doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);

    if (!doc) {
      try {
        const apiData = await scores365.getCompetitionHistory(MUNDIAL_ID);
        const row = apiData?.table?.rows?.find(r => r.seasonNum === seasonNum);
        if (row) {
          doc = {
            id: `${MUNDIAL_ID}-se${row.seasonNum}`,
            competitionId: MUNDIAL_ID,
            seasonNum: row.seasonNum,
            ...row,
            _fetchedAt: new Date().toISOString(),
          };
          await cosmos.upsert('competition_history', doc).catch(() => {});
        }
      } catch (e) {
        req.log?.warn?.({ err: e.message }, 'Error en fallback 365scores para history by season');
      }
    }

    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    const teamMap = await getCompetitorMap();
    res.json(parseHistoryDoc(doc, teamMap));
  } catch (err) {
    next(err);
  }
}

async function getHistoryMatchStats(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    let cached = await cosmos.getById('history_match_stats', `stats-${MUNDIAL_ID}-se${seasonNum}`, seasonNum);
    if (cached?.data) return res.json(cached.data);

    let doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);
    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    const game = doc.group?.games?.[0];
    const gameData = game?.game || game;
    const gameId = gameData?.id || game?.gameId;
    if (!gameId) return res.json(null);

    const stats = await scores365.getGameStats(gameId);

    await cosmos.upsert('history_match_stats', {
      id: `stats-${MUNDIAL_ID}-se${seasonNum}`,
      seasonNum,
      competitionId: MUNDIAL_ID,
      data: stats,
      _fetchedAt: new Date().toISOString(),
    }).catch(() => {});

    res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function getHistoryMatchOverview(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    let cached = await cosmos.getById('history_match_overviews', `overview-${MUNDIAL_ID}-se${seasonNum}`, seasonNum);
    if (cached?.data) return res.json(cached.data);

    let doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);
    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    const game = doc.group?.games?.[0];
    const gameData = game?.game || game;
    const gameId = gameData?.id || game?.gameId;
    if (!gameId) return res.json(null);

    const homeId = gameData?.homeCompetitor?.id;
    const awayId = gameData?.awayCompetitor?.id;
    const matchupId = (homeId && awayId) ? `${homeId}-${awayId}-${MUNDIAL_ID}` : undefined;

    const overview = await scores365.getGameOverview(gameId, matchupId);

    await cosmos.upsert('history_match_overviews', {
      id: `overview-${MUNDIAL_ID}-se${seasonNum}`,
      seasonNum,
      competitionId: MUNDIAL_ID,
      data: overview,
      _fetchedAt: new Date().toISOString(),
    }).catch(() => {});

    res.json(overview);
  } catch (err) {
    next(err);
  }
}

async function getHistoryDescription(req, res, next) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    let cached = await cosmos.getById('history_descriptions', `desc-${MUNDIAL_ID}-se${seasonNum}`, seasonNum);
    if (cached?.data) return res.json(cached.data);

    let doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);
    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    let entityType, entityId;
    if (doc.entityId) {
      entityType = 2;
      entityId = doc.entityId;
    } else {
      const game = doc.group?.games?.[0];
      const gameData = game?.game || game;
      entityType = 5;
      entityId = gameData?.id || game?.gameId;
    }

    if (!entityId) return res.json(null);

    const raw = await scores365.getEntityDescription(entityType, entityId);
    const sections = raw?.sections || [];
    const descriptions = sections
      .filter(s => s.type === 'ENTITY_DESCRIPTION')
      .flatMap(s => s.competitorsSeasons?.map(cs => cs.html) || []);

    await cosmos.upsert('history_descriptions', {
      id: `desc-${MUNDIAL_ID}-se${seasonNum}`,
      seasonNum,
      competitionId: MUNDIAL_ID,
      data: descriptions,
      _fetchedAt: new Date().toISOString(),
    }).catch(() => {});

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
