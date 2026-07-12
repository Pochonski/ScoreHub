const path = require('path');

// Shared cosmos/images/scores365 from parent project
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));
const scores365 = require(path.join(__dirname, '..', '..', '..', 'services', 'scores365Service'));

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const CURRENT_SEASON = parseInt(process.env.SCORES365_SEASON || '25', 10);

const COMPETITION_PK = String(MUNDIAL_ID);

// ---- Competitor name cache ----
let _compMap = null;
let _compMapAt = 0;
const COMP_MAP_TTL = 300_000; // 5 min

// ---- History in-memory cache ----
let _historyCache = { data: null, expiry: 0 };
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function getCompetitorMap() {
  const now = Date.now();
  if (_compMap && now - _compMapAt < COMP_MAP_TTL) return _compMap;
  const map = {};
  try {
    const data = await scores365.getTopCompetitors(500);
    const comps = data?.competitors || [];
    for (const c of comps) {
      map[String(c.id)] = { name: c.name, imageVersion: c.imageVersion || 1 };
    }
  } catch (_) { /* fall back to empty map */ }
  _compMap = map;
  _compMapAt = now;
  return map;
}

function enrichTransferWithTeam(t, teamMap) {
  const id = String(t.competitorId);
  const info = teamMap[id];
  return {
    ...t,
    competitorName: info?.name || null,
    competitorBadge: info ? images.getTeamBadgeUrl(t.competitorId, info.imageVersion) : null,
  };
}

const SEASON_TO_YEAR = {
  1: 1930, 2: 1934, 3: 1938, 4: 1950, 5: 1954, 6: 1958, 7: 1962, 8: 1966,
  9: 1970, 10: 1974, 11: 1978, 12: 1982, 13: 1986, 14: 1990, 15: 1994,
  16: 1998, 17: 2002, 18: 2006, 19: 2010, 20: 2014, 21: 2018, 22: 2022,
};

const LINE_TYPE_LABELS = {
  1: 'Ganador',
  3: 'Over/Under',
  7: 'Primer gol',
  12: 'Ambos marcan',
  14: 'Doble oportunidad',
};

const SCORE_STAT_IDS = {
  1: 'Goles',
  6: 'Córners',
  14: 'Tiros',
  15: 'Tiros al arco',
  21: 'Fueras de juego',
  31: 'Tarjetas amarillas',
  32: 'Tarjetas rojas',
  41: 'Posesión %',
  43: 'Pases totales',
  52: 'Faltas',
};

// ---- Helpers ----

function enrichTeam(competitor, imageVersion) {
  if (!competitor) return null;
  return {
    id: competitor.id,
    name: competitor.name,
    shortName: competitor.shortName,
    score: competitor.score != null && competitor.score >= 0 ? competitor.score : undefined,
    badgeUrl: competitor.id ? images.getTeamBadgeUrl(competitor.id, imageVersion || competitor.imageVersion || 1) : null,
    flagUrl: competitor.countryId ? images.getCountryFlagUrl(competitor.countryId) : null,
  };
}

function enrichAthlete(athlete) {
  if (!athlete) return null;
  return {
    ...athlete,
    photoUrl: athlete.id ? images.getAthletePhotoUrl(athlete.id, athlete.imageVersion) : null,
    thumbnailUrl: athlete.id ? images.getAthleteThumbUrl(athlete.id, athlete.imageVersion) : null,
  };
}

async function enrichAthleteTransfers(athlete) {
  if (!athlete?.transfers?.length) return athlete;
  const map = await getCompetitorMap();
  athlete.transfers = athlete.transfers.map(t => enrichTransferWithTeam(t, map));
  return athlete;
}

function enrichGame(game) {
  if (!game) return null;
  const homeComp = game.homeCompetitor || {};
  const awayComp = game.awayCompetitor || {};
  return {
    id: game.id,
    competitionId: game.competitionId,
    statusGroup: game.statusGroup,
    status: game.statusGroup === 1 ? 'live' : game.statusGroup === 2 ? 'upcoming' : game.statusGroup === 4 ? 'finished' : 'upcoming',
    stage: game.stageName || '',
    stageName: game.stageName || '',
    groupNum: game.groupNum,
    startTime: game.startTime,
    statusText: game.statusText || null,
    minute: game.minute || game.statusText ? parseInt(game.statusText) || null : null,
    homeTeam: enrichTeam(homeComp, game.homeCompetitor?.imageVersion),
    awayTeam: enrichTeam(awayComp, game.awayCompetitor?.imageVersion),
  };
}

function enrichTrend(t) {
  return {
    text: t.text,
    percentage: t.percentage,
    betCTA: t.betCTA || LINE_TYPE_LABELS[t.lineTypeId] || '',
    lineTypeId: t.lineTypeId,
    lineTypeLabel: LINE_TYPE_LABELS[t.lineTypeId] || `Tipo ${t.lineTypeId}`,
  };
}

function enrichTip(tipDoc) {
  if (!tipDoc) return null;
  return {
    gameId: tipDoc.gameId,
    confidenceScore: tipDoc.confidenceScore,
    generatedAt: tipDoc.generatedAt,
    topTrends: (tipDoc.topTrends || []).map(enrichTrend),
    allTrends: (tipDoc.allTrends || []).map(enrichTrend),
  };
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Costa_Rica',
    });
  } catch { return iso; }
}

// ---- Controllers ----

async function getMatches(req, res) {
  try {
    const { statusGroup, stage, teamId } = req.query;
    const params = [{ name: '@compId', value: COMPETITION_PK }];
    let query = 'SELECT * FROM c WHERE c.competitionId = @compId';

    if (statusGroup) {
      const groups = statusGroup.split(',').map(Number).filter(n => !isNaN(n));
      if (groups.length > 0) {
        const groupParams = groups.map((g, i) => {
          params.push({ name: `@sg${i}`, value: g });
          return `@sg${i}`;
        });
        query += ` AND c.statusGroup IN (${groupParams.join(',')})`;
      }
    }
    if (stage) {
      query += ' AND CONTAINS(LOWER(c.stageName), @stage)';
      params.push({ name: '@stage', value: stage.toLowerCase() });
    }
    if (teamId) {
      const tid = Number(teamId);
      if (!isNaN(tid)) {
        params.push({ name: '@tid', value: tid });
        query += ' AND (c.homeCompetitor.id = @tid OR c.awayCompetitor.id = @tid)';
      }
    }

    query += ' ORDER BY c.startTime DESC';

    let games = await cosmos.queryAll('games', { query, parameters: params });

    // Filter out past games incorrectly marked as upcoming (statusGroup 2)
    if (!statusGroup || statusGroup === '2') {
      const now = new Date();
      const GRACE_MS = 3 * 60 * 60 * 1000;
      games = games.filter(g => g.statusGroup !== 2 || !g.startTime || new Date(g.startTime).getTime() > now.getTime() - GRACE_MS);
    }

    res.json(games.map(enrichGame));
  } catch (err) {
    console.error('[GET /matches]', err.message);
    res.status(500).json({ error: 'Error al cargar partidos' });
  }
}

async function getLiveMatches(req, res) {
  try {
    const query = {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 1 ORDER BY c.startTime ASC`,
    };
    const games = await cosmos.queryAll('games', query);
    res.json(games.map(enrichGame));
  } catch (err) {
    console.error('[GET /matches/live]', err.message);
    res.status(500).json({ error: 'Error al cargar partidos en vivo' });
  }
}

async function getFeaturedMatch(req, res) {
  try {
    // Priority 1: live game
    let query = {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 1 ORDER BY c.startTime ASC`,
    };
    let games = await cosmos.queryAll('games', query);

    if (games.length === 0) {
      // Priority 2: upcoming game (next one) — skip games already past
      query.query = `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 2 ORDER BY c.startTime ASC`;
      games = await cosmos.queryAll('games', query);
      const now = new Date();
      const GRACE_MS = 3 * 60 * 60 * 1000; // 3h grace for games in progress but not marked live
      games = games.filter(g => !g.startTime || new Date(g.startTime).getTime() > now.getTime() - GRACE_MS);
    }

    if (games.length === 0) {
      // Priority 3: most recent finished
      query.query = `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 4 ORDER BY c.startTime DESC`;
      games = await cosmos.queryAll('games', query);
    }

    const game = games[0] || null;
    res.json(enrichGame(game));
  } catch (err) {
    console.error('[GET /matches/featured]', err.message);
    res.status(500).json({ error: 'Error al cargar partido destacado' });
  }
}

async function getMatchById(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Try Cosmos (use query to avoid partition key type mismatch)
    const games = await cosmos.queryAll('games', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.id = ${gid}`,
    });
    if (games.length > 0) return res.json(enrichGame(games[0]));

    // Fallback: 365scores API
    const overview = await scores365.getGameOverview(gid);
    if (!overview?.game) return res.status(404).json({ error: 'Partido no encontrado' });

    res.json(enrichGame(overview.game));
  } catch (err) {
    console.error('[GET /matches/:id]', err.message);
    res.status(500).json({ error: 'Error al cargar partido' });
  }
}

async function getMatchStats(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    // Try game_snapshots first
    const snap = await cosmos.queryOne('game_snapshots', {
      query: `SELECT TOP 1 c.statistics FROM c WHERE c.gameId = ${gid} ORDER BY c._ts DESC`,
    });

    if (snap?.statistics) {
      const stats = snap.statistics.map(s => ({
        statId: s.statId,
        label: SCORE_STAT_IDS[s.statId] || `Stat ${s.statId}`,
        homeValue: s.home,
        awayValue: s.away,
      })).filter(s => SCORE_STAT_IDS[s.statId]);
      return res.json(stats);
    }

    // Fallback: try pre-stats
    const pre = await cosmos.getById('game_pre_stats', String(gid), String(gid));
    if (pre?.statistics) {
      return res.json(pre.statistics.map(s => ({
        statId: s.type,
        label: s.label || SCORE_STAT_IDS[s.type] || `Stat ${s.type}`,
        homeValue: s.preMatchHome,
        awayValue: s.preMatchAway,
      })));
    }

    res.json([]);
  } catch (err) {
    console.error('[GET /matches/:id/stats]', err.message);
    res.json([]);
  }
}

async function getMatchH2h(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const doc = await cosmos.getById('game_h2h', String(gid), gid);

    if (!doc) return res.json(null);

    const result = {
      recentGames: [],
      h2hGames: [],
    };

    if (doc.game?.homeCompetitor?.recentGames) {
      result.recentGames = doc.game.homeCompetitor.recentGames.map(enrichGame);
    }
    if (doc.game?.awayCompetitor?.recentGames) {
      result.recentGames = [...result.recentGames, ...doc.game.awayCompetitor.recentGames.map(enrichGame)];
    }
    if (doc.game?.h2hGames) {
      result.h2hGames = doc.game.h2hGames.map(enrichGame);
    }

    res.json(result);
  } catch (err) {
    console.error('[GET /matches/:id/h2h]', err.message);
    res.json(null);
  }
}

function extractLineup(competitor) {
  if (!competitor?.lineups?.members?.length) return null;
  const members = (competitor.lineups.members || []).filter(m => m.athleteId || m.name);
  if (!members.length) return null;
  return {
    formation: competitor.lineups.formation || '',
    members: members.map(m => ({
      athleteId: m.athleteId || m.id,
      name: m.name,
      shortName: m.shortName,
      position: m.position?.name || m.positionName || '',
      shirtNumber: m.shirtNumber,
      photoUrl: (m.athleteId || m.id) ? images.getAthleteThumbUrl(m.athleteId || m.id) : null,
      rating: m.rating,
    })),
  };
}

async function getMatchLineups(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Try Cosmos sources first
    for (const container of ['game_h2h', 'game_overviews']) {
      const doc = container === 'game_h2h'
        ? await cosmos.getById('game_h2h', String(gid), gid)
        : await cosmos.queryOne('game_overviews', {
            query: `SELECT * FROM c WHERE c.gameId = ${gid} ORDER BY c._ts DESC`,
          });
      const home = extractLineup(doc?.game?.homeCompetitor);
      const away = extractLineup(doc?.game?.awayCompetitor);
      if (home || away) return res.json({ home, away });
    }

    // Fallback: 365scores
    const overview = await scores365.getGameOverview(gid);
    const home = extractLineup(overview?.game?.homeCompetitor);
    const away = extractLineup(overview?.game?.awayCompetitor);
    if (home || away) return res.json({ home, away });

    res.json(null);
  } catch (err) {
    console.error('[GET /matches/:id/lineups]', err.message);
    res.json(null);
  }
}

async function getMatchPreStats(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Try Cosmos first
    const pre = await cosmos.queryOne('game_pre_stats', {
      query: `SELECT * FROM c WHERE c.gameId = ${gid}`,
    });
    if (pre?.statistics) {
      return res.json(pre.statistics.map(s => ({
        statId: s.type,
        label: s.label || SCORE_STAT_IDS[s.type] || `Stat ${s.type}`,
        homeValue: s.preMatchHome,
        awayValue: s.preMatchAway,
      })));
    }

    // Fallback: 365scores pre-game stats (per-team stats)
    const apiData = await scores365.getGamePreStats(gid);
    if (!apiData?.statistics?.length) return res.json([]);

    // Group stats by competitor
    const byTeam = {};
    apiData.statistics.forEach(s => {
      const cid = s.competitorId;
      if (!cid) return;
      if (!byTeam[cid]) byTeam[cid] = [];
      byTeam[cid].push({ name: s.name, value: s.value, group: s.statisticGroup || 1 });
    });

    const teamIds = Object.keys(byTeam);
    // Return structured team stats
    res.json({
      teamStats: teamIds.map(cid => ({
        competitorId: Number(cid),
        stats: byTeam[cid],
      })),
    });
  } catch (err) {
    console.error('[GET /matches/:id/pre-stats]', err.message);
    res.json([]);
  }
}

async function getMatchTips(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const tipDoc = await cosmos.getById('betting_tips', `${gid}-composite`, gid);
    res.json(enrichTip(tipDoc));
  } catch (err) {
    console.error('[GET /matches/:id/tips]', err.message);
    res.json(null);
  }
}

async function getMatchTrends(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const trends = await cosmos.queryAll('trends', {
      query: `SELECT * FROM c WHERE c.scope = 'game' AND c.gameId = ${gid} ORDER BY c.percentage DESC`,
    });
    // Deduplicate by lineTypeId
    const seen = new Set();
    const unique = trends.filter(t => {
      const key = `${t.betCTA || ''}|${t.lineTypeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json(unique.map(enrichTrend));
  } catch (err) {
    console.error('[GET /matches/:id/trends]', err.message);
    res.json([]);
  }
}

async function getMatchPredictions(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Try Cosmos
    const pred = await cosmos.queryOne('predictions', {
      query: `SELECT * FROM c WHERE c.gameId = ${gid}`,
    });
    if (pred?.promotedPredictions?.predictions) {
      return res.json(pred.promotedPredictions.predictions.map(p => ({
        title: p.title,
        totalVotes: p.totalVotes,
        options: (p.options || []).map(o => ({
          text: o.text,
          percentage: o.percentage || (o.voteCount / p.totalVotes * 100),
          voteCount: o.voteCount,
        })),
      })));
    }

    // Fallback: 365scores (promotedPredictions from game overview)
    const overview = await scores365.getGameOverview(gid);
    const pp = overview?.game?.promotedPredictions;
    if (pp?.predictions?.length) {
      return res.json(pp.predictions.map(p => ({
        title: p.title,
        totalVotes: p.totalVotes,
        options: (p.options || []).map(o => ({
          text: o.text,
          percentage: o.percentage || (o.voteCount / p.totalVotes * 100),
          voteCount: o.voteCount,
        })),
      })));
    }

    res.json([]);
  } catch (err) {
    console.error('[GET /matches/:id/predictions]', err.message);
    res.json([]);
  }
}

async function getMatchTimeline(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const snap = await cosmos.queryOne('game_snapshots', {
      query: `SELECT TOP 1 c.timeline, c.events FROM c WHERE c.gameId = ${gid} ORDER BY c._ts DESC`,
    });

    const events = snap?.timeline || snap?.events || [];
    res.json(events.map(e => ({
      minute: e.minute || e.matchTime,
      type: e.type === 1 ? 'goal' : e.type === 2 ? 'yellow_card' : e.type === 3 ? 'red_card' : 'event',
      teamId: e.teamId || e.competitorId,
      playerName: e.playerName || e.player?.name,
      description: e.description || e.text,
    })));
  } catch (err) {
    console.error('[GET /matches/:id/timeline]', err.message);
    res.json([]);
  }
}

const GROUP_NAMES = [
  'Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
  'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L',
];

function transformStandingRow(r, competitorId) {
  // Derive W/D/L from detailedRecentForm
  const form = (r.detailedRecentForm || []).slice(0, 5).map(m => {
    const homeId = m.homeCompetitor?.id;
    const awayId = m.awayCompetitor?.id;
    if (m.winner === 0) return 'D';
    if (competitorId == null) return '';
    if (m.winner === 1 && homeId === competitorId) return 'W';
    if (m.winner === 2 && awayId === competitorId) return 'W';
    return 'L';
  }).filter(Boolean);

  return {
    position: r.position || 0,
    team: {
      id: r.competitor?.id,
      name: r.competitor?.name || '',
      badgeUrl: r.competitor?.id ? images.getTeamBadgeUrl(r.competitor.id, r.competitor.imageVersion || 1) : null,
    },
    played: r.gamePlayed || r.gamesPlayed || 0,
    won: r.gamesWon || 0,
    drawn: r.gamesEven || 0,
    lost: r.gamesLost || 0,
    goalsFor: r.for || r.goalsFor || 0,
    goalsAgainst: r.against || r.goalsAgainst || 0,
    goalDiff: r.ratio != null ? r.ratio : ((r.for || 0) - (r.against || 0)),
    points: r.points || 0,
    recentForm: form,
  };
}

async function getStandings(req, res) {
  try {
    // Try Cosmos first
    const query = {
      query: 'SELECT * FROM c WHERE c.competitionId = @compId AND c.stageNum = 1 ORDER BY c.seasonNum DESC',
      parameters: [{ name: '@compId', value: COMPETITION_PK }],
    };
    const docs = await cosmos.queryAll('standings', query);

    if (docs.length > 0) {
      const groups = docs.map(doc => ({
        name: doc.name || GROUP_NAMES[(doc.groupNum || 1) - 1] || `Grupo ${doc.groupNum}`,
        rows: (doc.rows || []).map((r, i) => ({
          position: i + 1,
          team: {
            id: r.competitor?.id,
            name: r.competitor?.name || r.teamName,
            badgeUrl: r.competitor?.id ? images.getTeamBadgeUrl(r.competitor.id, r.competitor.imageVersion || 1) : null,
          },
          played: r.played || r.gamesPlayed || 0,
          won: r.won || r.gamesWon || 0,
          drawn: r.drawn || r.gamesEven || 0,
          lost: r.lost || r.gamesLost || 0,
          goalsFor: r.goalsFor || 0,
          goalsAgainst: r.goalsAgainst || 0,
          goalDiff: (r.goalDiff != null) ? r.goalDiff : ((r.goalsFor || 0) - (r.goalsAgainst || 0)),
          points: r.points || 0,
          recentForm: r.recentForm || (r.form || '').split('') || [],
        })),
      }));
      return res.json(groups);
    }

    // Fallback: 365scores API
    const apiData = await scores365.getStandings(MUNDIAL_ID, 1, CURRENT_SEASON);
    if (!apiData?.standings?.length) return res.json([]);

    const rows = apiData.standings[0].rows || [];
    const groupsMap = new Map();

    rows.forEach(r => {
      const gn = r.groupNum || 1;
      if (!groupsMap.has(gn)) {
        groupsMap.set(gn, { name: GROUP_NAMES[gn - 1] || `Grupo ${gn}`, rows: [] });
      }
      groupsMap.get(gn).rows.push(transformStandingRow(r, r.competitor?.id));
    });

    const groups = Array.from(groupsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, g]) => ({
        ...g,
        rows: g.rows.sort((a, b) => a.position - b.position),
      }));

    res.json(groups);
  } catch (err) {
    console.error('[GET /standings]', err.message);
    res.status(500).json({ error: 'Error al cargar tabla de posiciones' });
  }
}

async function getBrackets(req, res) {
  try {
    const doc = await cosmos.getById('brackets', String(MUNDIAL_ID), COMPETITION_PK);
    if (!doc?.stages) return res.json([]);
    res.json(doc.stages.map(s => ({
      name: s.name,
      games: (s.games || []).map(g => ({
        id: g.id,
        homeTeam: g.homeCompetitor ? enrichTeam(g.homeCompetitor) : undefined,
        awayTeam: g.awayCompetitor ? enrichTeam(g.awayCompetitor) : undefined,
        score: g.homeCompetitor?.score != null ? { home: g.homeCompetitor.score, away: g.awayCompetitor?.score } : undefined,
        startTime: g.startTime,
      })),
    })));
  } catch (err) {
    console.error('[GET /brackets]', err.message);
    res.json([]);
  }
}

function parseHistoryDoc(d, teamMap) {
  const participants = (d.group?.participants || []).map(p => ({
    name: p.name,
    competitorId: p.competitorId,
    badgeUrl: p.competitorId ? images.getTeamBadgeUrl(p.competitorId, teamMap[String(p.competitorId)]?.imageVersion) : null,
  }));
  const game = d.group?.games?.[0];
  const gameData = game?.game || game;
  const year = game?.startTime ? new Date(game.startTime).getFullYear() : (SEASON_TO_YEAR[d.seasonNum] || d.seasonNum + 1930 - 1);
  const hostMatch = d.title ? d.title.match(/^(.+?)\s+\d{4}$/) : null;

  return {
    seasonNum: d.seasonNum,
    year,
    title: d.title || null,
    secondaryTitle: d.secondaryTitle || null,
    host: hostMatch ? hostMatch[1].trim() : null,
    entityId: d.entityId || null,
    matchId: gameData?.id || null,
    homeScore: gameData?.homeCompetitor?.score != null ? gameData.homeCompetitor.score : null,
    awayScore: gameData?.awayCompetitor?.score != null ? gameData.awayCompetitor.score : null,
    homePenaltyScore: gameData?.homeCompetitor?.penaltyScore != null ? gameData.homeCompetitor.penaltyScore : null,
    awayPenaltyScore: gameData?.awayCompetitor?.penaltyScore != null ? gameData.awayCompetitor.penaltyScore : null,
    extraTime: gameData?.homeCompetitor?.score != null && gameData?.awayCompetitor?.score != null
      && gameData?.homeCompetitor?.score === gameData?.awayCompetitor?.score
      && gameData?.winner !== 0 ? true : null,
    penalties: gameData?.homeCompetitor?.penaltyScore != null || gameData?.awayCompetitor?.penaltyScore != null ? true : null,
    champion: d.champion ? {
      name: d.champion.name,
      competitorId: d.champion.competitorId,
      badgeUrl: d.champion.competitorId ? images.getTeamBadgeUrl(d.champion.competitorId, teamMap[String(d.champion.competitorId)]?.imageVersion) : null,
    } : participants[0] ? {
      name: participants[0].name,
      competitorId: participants[0].competitorId,
      badgeUrl: participants[0].badgeUrl,
    } : (gameData?.homeCompetitor?.isWinner ? {
      name: gameData.homeCompetitor.name,
      competitorId: gameData.homeCompetitor.id,
      badgeUrl: gameData.homeCompetitor.id ? images.getTeamBadgeUrl(gameData.homeCompetitor.id, teamMap[String(gameData.homeCompetitor.id)]?.imageVersion) : null,
    } : (gameData?.awayCompetitor?.isWinner ? {
      name: gameData.awayCompetitor.name,
      competitorId: gameData.awayCompetitor.id,
      badgeUrl: gameData.awayCompetitor.id ? images.getTeamBadgeUrl(gameData.awayCompetitor.id, teamMap[String(gameData.awayCompetitor.id)]?.imageVersion) : null,
    } : null)),
    runnerUp: d.runnerUp ? {
      name: d.runnerUp.name,
      competitorId: d.runnerUp.competitorId,
      badgeUrl: d.runnerUp.competitorId ? images.getTeamBadgeUrl(d.runnerUp.competitorId, teamMap[String(d.runnerUp.competitorId)]?.imageVersion) : null,
    } : participants[1] ? {
      name: participants[1].name,
      competitorId: participants[1].competitorId,
      badgeUrl: participants[1].badgeUrl,
    } : gameData?.homeCompetitor && gameData?.awayCompetitor ? (gameData.homeCompetitor.isWinner ? {
      name: gameData.awayCompetitor.name,
      competitorId: gameData.awayCompetitor.id,
      badgeUrl: gameData.awayCompetitor.id ? images.getTeamBadgeUrl(gameData.awayCompetitor.id, teamMap[String(gameData.awayCompetitor.id)]?.imageVersion) : null,
    } : {
      name: gameData.homeCompetitor.name,
      competitorId: gameData.homeCompetitor.id,
      badgeUrl: gameData.homeCompetitor.id ? images.getTeamBadgeUrl(gameData.homeCompetitor.id, teamMap[String(gameData.homeCompetitor.id)]?.imageVersion) : null,
    }) : null,
    venue: game?.venue?.name || null,
    venueShortName: game?.venue?.shortName || null,
    startTime: game?.startTime || null,
    hasTable: d.hasTable || false,
    group: d.group ? {
      name: d.group.name || '',
      participants,
      games: (d.group.games || []).map(g => {
        const gd = g.game || g;
        return {
          num: g.num,
          gameId: gd?.id || g.gameId,
          startTime: g.startTime,
          venue: g.venue ? { name: g.venue.name, shortName: g.venue.shortName } : null,
          homeCompetitor: gd?.homeCompetitor ? {
            id: gd.homeCompetitor.id,
            name: gd.homeCompetitor.name,
            score: gd.homeCompetitor.score,
            penaltyScore: gd.homeCompetitor.penaltyScore,
            isWinner: gd.homeCompetitor.isWinner || false,
            badgeUrl: gd.homeCompetitor.id ? images.getTeamBadgeUrl(gd.homeCompetitor.id, teamMap[String(gd.homeCompetitor.id)]?.imageVersion) : null,
          } : null,
          awayCompetitor: gd?.awayCompetitor ? {
            id: gd.awayCompetitor.id,
            name: gd.awayCompetitor.name,
            score: gd.awayCompetitor.score,
            penaltyScore: gd.awayCompetitor.penaltyScore,
            isWinner: gd.awayCompetitor.isWinner || false,
            badgeUrl: gd.awayCompetitor.id ? images.getTeamBadgeUrl(gd.awayCompetitor.id, teamMap[String(gd.awayCompetitor.id)]?.imageVersion) : null,
          } : null,
        };
      }),
      venue: game?.venue?.name || null,
    } : null,
  };
}

async function getHistory(req, res) {
  try {
    // Check in-memory cache
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
        console.error('[getHistory] 365scores fallback error:', e.message);
      }
    }

    const teamMap = await getCompetitorMap();
    const result = docs.map(d => parseHistoryDoc(d, teamMap));

    // Update in-memory cache
    _historyCache = { data: result, expiry: Date.now() + HISTORY_CACHE_TTL_MS };

    res.json(result);
  } catch (err) {
    console.error('[GET /history]', err.message);
    res.json([]);
  }
}

async function getHistoryStats(req, res) {
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
        console.error('[getHistoryStats] 365scores fallback error:', e.message);
      }
    }

    const teamMap = await getCompetitorMap();
    const parsed = docs.map(d => parseHistoryDoc(d, teamMap));

    // Title count per champion
    const titleMap = {};
    // Final appearance count per team
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

    // Find repeating champions (back-to-back)
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
    console.error('[GET /history/stats]', err.message);
    res.json({
      totalEditions: 0, mostTitles: null, mostFinals: null,
      hosts: [], champions: [], repeatingChampions: [],
    });
  }
}

async function getHistoryBySeason(req, res) {
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
        console.error('[getHistoryBySeason] 365scores fallback error:', e.message);
      }
    }

    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    const teamMap = await getCompetitorMap();
    res.json(parseHistoryDoc(doc, teamMap));
  } catch (err) {
    console.error('[GET /history/:seasonNum]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getHistoryMatchStats(req, res) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    // Try cache first
    let cached = await cosmos.getById('history_match_stats', `stats-${MUNDIAL_ID}-se${seasonNum}`, seasonNum);
    if (cached?.data) {
      return res.json(cached.data);
    }

    // Get season doc for gameId
    let doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);
    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    const game = doc.group?.games?.[0];
    const gameData = game?.game || game;
    const gameId = gameData?.id || game?.gameId;
    if (!gameId) return res.json(null);

    const stats = await scores365.getGameStats(gameId);

    // Cache in Cosmos
    await cosmos.upsert('history_match_stats', {
      id: `stats-${MUNDIAL_ID}-se${seasonNum}`,
      seasonNum,
      competitionId: MUNDIAL_ID,
      data: stats,
      _fetchedAt: new Date().toISOString(),
    }).catch(() => {});

    res.json(stats);
  } catch (err) {
    console.error(`[GET /history/${req.params.seasonNum}/match-stats]`, err.message);
    res.json(null);
  }
}

async function getHistoryMatchOverview(req, res) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    // Try cache first
    let cached = await cosmos.getById('history_match_overviews', `overview-${MUNDIAL_ID}-se${seasonNum}`, seasonNum);
    if (cached?.data) {
      return res.json(cached.data);
    }

    // Get season doc for gameId and matchupId
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

    // Cache in Cosmos
    await cosmos.upsert('history_match_overviews', {
      id: `overview-${MUNDIAL_ID}-se${seasonNum}`,
      seasonNum,
      competitionId: MUNDIAL_ID,
      data: overview,
      _fetchedAt: new Date().toISOString(),
    }).catch(() => {});

    res.json(overview);
  } catch (err) {
    console.error(`[GET /history/${req.params.seasonNum}/match-overview]`, err.message);
    res.json(null);
  }
}

async function fetchAthleteStats(statCategoryId, statCategoryName) {
  // Try Cosmos first
  let payload = null;
  try {
    const doc = await cosmos.getById('tournament_stats', `${MUNDIAL_ID}-se${CURRENT_SEASON}-athletesStats`, COMPETITION_PK);
    payload = doc?.payload;
  } catch { /* ignore */ }

  // Fallback: fetch directly from 365scores API
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

  // Map category ID to the stat typeId that holds the primary value
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

async function getTopScorers(req, res) {
  try {
    const entries = await fetchAthleteStats(1, 'Goles');
    res.json(entries);
  } catch (err) {
    console.error('[GET /stats/scorers]', err.message);
    res.json([]);
  }
}

async function getTopAssists(req, res) {
  try {
    const entries = await fetchAthleteStats(3, 'Asistencias');
    res.json(entries);
  } catch (err) {
    console.error('[GET /stats/assists]', err.message);
    res.json([]);
  }
}

async function getTopRatings(req, res) {
  try {
    const entries = await fetchAthleteStats(7, 'Rating 365');
    res.json(entries);
  } catch (err) {
    console.error('[GET /stats/ratings]', err.message);
    res.json([]);
  }
}

async function getTeamOfWeek(req, res) {
  try {
    let tow = null;

    // Try Cosmos first
    const docs = await cosmos.queryAll('highlights', {
      query: `SELECT * FROM c WHERE c.kind = 'team_of_week' AND c.competitionId = ${MUNDIAL_ID} ORDER BY c._ts DESC`,
    });
    if (docs.length > 0) {
      // Cosmos has teamOfTheWeek, frontend TeamOfWeek component expects teamOfWeek
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
    console.error('[GET /stats/team-of-week]', err.message);
    res.json(null);
  }
}

async function getCompetitionTrends(req, res) {
  try {
    const trends = await cosmos.queryAll('trends', {
      query: `SELECT * FROM c WHERE c.scope = 'competition' AND c.competitionId = ${MUNDIAL_ID} ORDER BY c.percentage DESC`,
    });

    // Deduplicate by lineTypeId
    const seen = new Set();
    const unique = trends.filter(t => {
      const key = `${t.betCTA || ''}|${t.lineTypeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json(unique.slice(0, 10).map(enrichTrend));
  } catch (err) {
    console.error('[GET /trends]', err.message);
    res.json([]);
  }
}

async function getNews(req, res) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const scope = req.query.scope || 'comp';

    const news = await cosmos.queryAll('news', {
      query: 'SELECT * FROM c WHERE c.scope = @s AND c.competitionId = @compId ORDER BY c.publishDate DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@s', value: scope },
        { name: '@compId', value: COMPETITION_PK },
        { name: '@limit', value: limit },
      ],
    });
    res.json(news.map(n => ({
      id: n.id,
      title: n.title,
      publishDate: n.publishDate,
      image: n.image || null,
      url: n.url,
      sourceId: n.sourceId,
      gameId: n.gameId,
    })));
  } catch (err) {
    console.error('[GET /news]', err.message);
    res.json([]);
  }
}

async function getNewsByGame(req, res) {
  try {
    const { id } = req.params;

    const news = await cosmos.queryAll('news', {
      query: `SELECT * FROM c WHERE c.scope = 'game' AND c.gameId = ${Number(id)} ORDER BY c.publishDate DESC`,
    });
    res.json(news.map(n => ({
      id: n.id,
      title: n.title,
      publishDate: n.publishDate,
      image: n.image || null,
      url: n.url,
      sourceId: n.sourceId,
    })));
  } catch (err) {
    console.error('[GET /news/game/:id]', err.message);
    res.json([]);
  }
}

async function searchAthletes(req, res) {
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
    console.error('[GET /athletes]', err.message);
    res.json([]);
  }
}

async function getAthleteById(req, res) {
  try {
    const { id } = req.params;
    const athlete = await cosmos.getById('athletes', String(Number(id)), String(Number(id)));
    if (!athlete) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(await enrichAthleteTransfers(enrichAthlete(athlete)));
  } catch (err) {
    console.error('[GET /athletes/:id]', err.message);
    res.status(500).json({ error: 'Error al cargar jugador' });
  }
}

async function getAthleteCareer(req, res) {
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
    console.error('[GET /athletes/:id/career]', err.message);
    res.json([]);
  }
}

async function getAthleteTrophies(req, res) {
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
    console.error('[GET /athletes/:id/trophies]', err.message);
    res.json([]);
  }
}

async function getAthleteTransfers(req, res) {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    // Prefer athlete doc's own transfers (richer data), fall back to dedicated container
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
    console.error('[GET /athletes/:id/transfers]', err.message);
    res.json([]);
  }
}

async function getTeams(req, res) {
  try {
    const nationalOnly = req.query.national === 'true';
    let query = `SELECT * FROM c WHERE c.entityType = 'competitors'`;

    if (nationalOnly) {
      query += ` AND c.isNational = true`;
    }
    query += ' ORDER BY c.name ASC';

    const teams = await cosmos.queryAll('catalog', { query });
    res.json(teams.map(t => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion,
      badgeUrl: t.id ? images.getTeamBadgeUrl(t.id, t.imageVersion || 1) : null,
      flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
    })));
  } catch (err) {
    console.error('[GET /teams]', err.message);
    res.json([]);
  }
}

async function getTeamById(req, res) {
  try {
    const { id } = req.params;
    const tid = Number(id);
    const teams = await cosmos.queryAll('catalog', {
      query: `SELECT * FROM c WHERE c.entityType = 'competitors' AND c.id = ${tid}`,
    });
    if (teams.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });

    const t = teams[0];
    res.json({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion,
      badgeUrl: t.id ? images.getTeamBadgeUrl(t.id, t.imageVersion || 1) : null,
      flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
    });
  } catch (err) {
    console.error('[GET /teams/:id]', err.message);
    res.status(500).json({ error: 'Error al cargar equipo' });
  }
}

async function getTeamMatches(req, res) {
  try {
    const { id } = req.params;
    const tid = Number(id);
    const games = await cosmos.queryAll('games', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND (c.homeCompetitor.id = ${tid} OR c.awayCompetitor.id = ${tid}) ORDER BY c.startTime DESC`,
    });
    res.json(games.map(enrichGame));
  } catch (err) {
    console.error('[GET /teams/:id/matches]', err.message);
    res.json([]);
  }
}

async function getCountries(req, res) {
  try {
    const countries = await cosmos.queryAll('catalog', {
      query: "SELECT * FROM c WHERE c.entityType = 'countries' ORDER BY c.name ASC",
    });
    res.json(countries.map(c => ({
      id: c.id,
      name: c.name,
      flagUrl: c.id ? images.getCountryFlagUrl(Number(c.id)) : null,
    })));
  } catch (err) {
    console.error('[GET /countries]', err.message);
    res.json([]);
  }
}

function buildMatchupId(game) {
  if (!game) return '';
  const homeId = game.homeCompetitor?.id || game.homeTeam?.id;
  const awayId = game.awayCompetitor?.id || game.awayTeam?.id;
  if (!homeId || !awayId) return '';
  return `${homeId}-${awayId}-${game.competitionId || MUNDIAL_ID}`;
}

async function getMatchSuggestions(req, res) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Get game to extract matchupId
    let game;
    const games = await cosmos.queryAll('games', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.id = ${gid}`,
    });
    if (games.length > 0) {
      game = games[0];
    } else {
      const overview = await scores365.getGameOverview(gid);
      game = overview?.game;
    }
    if (!game) return res.json([]);

    const matchupId = buildMatchupId(game);
    const suggestions = await scores365.getGameSuggestions(gid, matchupId);
    if (!suggestions?.games?.length) return res.json([]);

    res.json(suggestions.games.map(enrichGame));
  } catch (err) {
    console.error('[GET /matches/:id/suggestions]', err.message);
    res.json([]);
  }
}

async function getHistoryDescription(req, res) {
  try {
    const seasonNum = parseInt(req.params.seasonNum, 10);
    if (isNaN(seasonNum)) return res.status(400).json({ error: 'seasonNum inválido' });

    // Check cache first
    let cached = await cosmos.getById('history_descriptions', `desc-${MUNDIAL_ID}-se${seasonNum}`, seasonNum);
    if (cached?.data) {
      return res.json(cached.data);
    }

    // Get season doc to find entityId / matchId
    let doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);
    if (!doc) return res.status(404).json({ error: 'Edición no encontrada' });

    // Try entityId (Competition type = 2) first, fall back to matchId (Game type = 5)
    let entityType, entityId;
    if (doc.entityId) {
      entityType = 2; // Competition
      entityId = doc.entityId;
    } else {
      const game = doc.group?.games?.[0];
      const gameData = game?.game || game;
      entityType = 5; // Game
      entityId = gameData?.id || game?.gameId;
    }

    if (!entityId) return res.json(null);

    const raw = await scores365.getEntityDescription(entityType, entityId);
    const sections = raw?.sections || [];
    const descriptions = sections
      .filter(s => s.type === 'ENTITY_DESCRIPTION')
      .flatMap(s => s.competitorsSeasons?.map(cs => cs.html) || []);

    // Cache in Cosmos
    await cosmos.upsert('history_descriptions', {
      id: `desc-${MUNDIAL_ID}-se${seasonNum}`,
      seasonNum,
      competitionId: MUNDIAL_ID,
      data: descriptions,
      _fetchedAt: new Date().toISOString(),
    }).catch(() => {});

    res.json(descriptions);
  } catch (err) {
    console.error(`[GET /history/${req.params.seasonNum}/description]`, err.message);
    res.json(null);
  }
}

async function getTournamentInfo(req, res) {
  try {
    const competitions = await cosmos.queryAll('catalog', {
      query: `SELECT * FROM c WHERE c.entityType = 'competitions' AND c.id = ${MUNDIAL_ID}`,
    });
    if (competitions.length === 0) {
      return res.json({
        id: MUNDIAL_ID,
        name: 'Mundial 2026',
        seasonNum: CURRENT_SEASON,
        format: '48 equipos, 12 grupos, fase eliminatoria',
      });
    }
    const c = competitions[0];
    res.json({
      id: c.id,
      name: c.name,
      nameForURL: c.nameForURL,
      countryId: c.countryId,
      seasonNum: c.currentSeasonNum || CURRENT_SEASON,
      imageVersion: c.imageVersion,
    });
  } catch (err) {
    console.error('[GET /tournament-info]', err.message);
    res.json({ id: MUNDIAL_ID, name: 'Mundial 2026' });
  }
}

module.exports = {
  getMatches,
  getLiveMatches,
  getFeaturedMatch,
  getMatchById,
  getMatchStats,
  getMatchH2h,
  getMatchLineups,
  getMatchPreStats,
  getMatchTips,
  getMatchTrends,
  getMatchPredictions,
  getMatchTimeline,
  getMatchSuggestions,
  getStandings,
  getBrackets,
  getHistory,
  getHistoryStats,
  getHistoryBySeason,
  getHistoryMatchStats,
  getHistoryMatchOverview,
  getHistoryDescription,
  getTopScorers,
  getTopAssists,
  getTopRatings,
  getTeamOfWeek,
  getCompetitionTrends,
  getNews,
  getNewsByGame,
  searchAthletes,
  getAthleteById,
  getAthleteCareer,
  getAthleteTrophies,
  getAthleteTransfers,
  getTeams,
  getTeamById,
  getTeamMatches,
  getCountries,
  getTournamentInfo,
};
