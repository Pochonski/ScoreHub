const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const scores365 = require(path.join(__dirname, '..', '..', '..', 'services', 'scores365Service'));
const { enrichGame, enrichTip, enrichTrend, extractLineup, buildMatchupId, SCORE_STAT_IDS } = require('../utils/mappers');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const COMPETITION_PK = String(MUNDIAL_ID);

async function getMatches(req, res, next) {
  try {
    const { statusGroup, stage, teamId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const params = [{ name: '@compId', value: COMPETITION_PK }];
    let query = 'SELECT c.id, c.competitionId, c.statusGroup, c.startTime, c.stageName, c.groupNum, c.statusText, c.minute, c.homeCompetitor, c.awayCompetitor FROM c WHERE c.competitionId = @compId';

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

    query += ' ORDER BY c.startTime DESC OFFSET @offset LIMIT @limit';
    params.push({ name: '@offset', value: offset }, { name: '@limit', value: limit });

    let games = await cosmos.queryAll('games', { query, parameters: params });

    if (!statusGroup || statusGroup === '2') {
      const now = new Date();
      const GRACE_MS = 3 * 60 * 60 * 1000;
      games = games.filter(g => g.statusGroup !== 2 || !g.startTime || new Date(g.startTime).getTime() > now.getTime() - GRACE_MS);
    }

    res.json(games.map(enrichGame));
  } catch (err) {
    next(err);
  }
}

async function getLiveMatches(req, res, next) {
  try {
    const query = {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 1 ORDER BY c.startTime ASC`,
    };
    const games = await cosmos.queryAll('games', query);
    res.json(games.map(enrichGame));
  } catch (err) {
    next(err);
  }
}

async function getFeaturedMatch(req, res, next) {
  try {
    let query = {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 1 ORDER BY c.startTime ASC`,
    };
    let games = await cosmos.queryAll('games', query);

    if (games.length === 0) {
      query.query = `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 2 ORDER BY c.startTime ASC`;
      games = await cosmos.queryAll('games', query);
      const now = new Date();
      const GRACE_MS = 3 * 60 * 60 * 1000;
      games = games.filter(g => !g.startTime || new Date(g.startTime).getTime() > now.getTime() - GRACE_MS);
    }

    if (games.length === 0) {
      query.query = `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.statusGroup = 4 ORDER BY c.startTime DESC`;
      games = await cosmos.queryAll('games', query);
    }

    const game = games[0] || null;
    res.json(enrichGame(game));
  } catch (err) {
    next(err);
  }
}

async function getMatchById(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const games = await cosmos.queryAll('games', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND c.id = ${gid}`,
    });
    if (games.length > 0) return res.json(enrichGame(games[0]));

    const overview = await scores365.getGameOverview(gid);
    if (!overview?.game) return res.status(404).json({ error: 'Partido no encontrado' });

    res.json(enrichGame(overview.game));
  } catch (err) {
    next(err);
  }
}

async function getMatchStats(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

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
    next(err);
  }
}

async function getMatchH2h(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const doc = await cosmos.getById('game_h2h', String(gid), gid);

    if (!doc) return res.json(null);

    const result = { recentGames: [], h2hGames: [] };

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
    next(err);
  }
}

async function getMatchLineups(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

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

    const overview = await scores365.getGameOverview(gid);
    const home = extractLineup(overview?.game?.homeCompetitor);
    const away = extractLineup(overview?.game?.awayCompetitor);
    if (home || away) return res.json({ home, away });

    res.json(null);
  } catch (err) {
    next(err);
  }
}

async function getMatchPreStats(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

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

    const apiData = await scores365.getGamePreStats(gid);
    if (!apiData?.statistics?.length) return res.json([]);

    const byTeam = {};
    apiData.statistics.forEach(s => {
      const cid = s.competitorId;
      if (!cid) return;
      if (!byTeam[cid]) byTeam[cid] = [];
      byTeam[cid].push({ name: s.name, value: s.value, group: s.statisticGroup || 1 });
    });

    const teamIds = Object.keys(byTeam);
    res.json({
      teamStats: teamIds.map(cid => ({
        competitorId: Number(cid),
        stats: byTeam[cid],
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getMatchTips(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const tipDoc = await cosmos.getById('betting_tips', `${gid}-composite`, gid);
    res.json(enrichTip(tipDoc));
  } catch (err) {
    next(err);
  }
}

async function getMatchTrends(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const trends = await cosmos.queryAll('trends', {
      query: `SELECT * FROM c WHERE c.scope = 'game' AND c.gameId = ${gid} ORDER BY c.percentage DESC`,
    });

    const seen = new Set();
    const unique = trends.filter(t => {
      const key = `${t.betCTA || ''}|${t.lineTypeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json(unique.map(enrichTrend));
  } catch (err) {
    next(err);
  }
}

async function getMatchPredictions(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

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
    next(err);
  }
}

async function getMatchTimeline(req, res, next) {
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
    next(err);
  }
}

async function getMatchSuggestions(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

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
    next(err);
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
};
