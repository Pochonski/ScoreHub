const { pool } = require('../../../database/connection');
const scores365 = require('../../../services/scores365Service');
const { enrichGame, enrichTrend, extractLineup, buildLineups, buildMatchupId, SCORE_STAT_IDS, MAJOR_STAT_IDS } = require('../utils/mappers');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

/**
 * Pivotear la lista plana de statistics de 365scores a una fila por stat
 * con homeValue/awayValue. Cada entrada del upstream tiene
 * { id, competitorId, value, isMajor, isTop }; hay que agrupar por id y
 * separar por equipo.
 *
 * Si homeId/awayId no se conocen (p.ej. el partido no esta en la tabla games),
 * se infieren del orden de aparicion: el primer competitorId visto es home,
 * el segundo es away.
 */
function pivotStats(flat, homeId, awayId) {
  if (!Array.isArray(flat)) return [];
  // Inferir competitorIds si no vinieron.
  let inferredHome = homeId;
  let inferredAway = awayId;
  if (inferredHome == null || inferredAway == null) {
    const seen = [];
    for (const s of flat) {
      if (s.competitorId != null && !seen.includes(s.competitorId)) seen.push(s.competitorId);
      if (seen.length >= 2) break;
    }
    if (inferredHome == null) inferredHome = seen[0];
    if (inferredAway == null) inferredAway = seen[1];
  }

  const byStat = new Map();
  for (const s of flat) {
    const sid = s.id ?? s.statId ?? s.type;
    if (sid == null || !SCORE_STAT_IDS[sid]) continue;
    if (!byStat.has(sid)) {
      byStat.set(sid, {
        statId: sid,
        homeValue: null,
        awayValue: null,
        isMajor: Boolean(s.isMajor) || MAJOR_STAT_IDS.has(sid),
        isTop: Boolean(s.isTop),
      });
    }
    const row = byStat.get(sid);
    if (s.isMajor) row.isMajor = true;
    if (s.isTop) row.isTop = true;
    const val = s.value ?? 0;
    if (s.competitorId === inferredHome) row.homeValue = val;
    else if (s.competitorId === inferredAway) row.awayValue = val;
  }
  return [...byStat.values()]
    // Mostrar TODAS las stats mapeadas que tengan al menos un valor.
    .filter(r => (r.isMajor || r.isTop || SCORE_STAT_IDS[r.statId]) && (r.homeValue != null || r.awayValue != null))
    .sort((a, b) => {
      if (a.isMajor !== b.isMajor) return a.isMajor ? -1 : 1;
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
      return a.statId - b.statId;
    })
    .map(r => ({
      statId: r.statId,
      label: SCORE_STAT_IDS[r.statId],
      homeValue: r.homeValue ?? 0,
      awayValue: r.awayValue ?? 0,
      isMajor: r.isMajor,
    }));
}

async function getMatches(req, res, next) {
  try {
    const { statusGroup, stage, teamId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    let query = 'SELECT data FROM games WHERE competition_id = $1';
    const params = [COMPETITION_ID];

    if (statusGroup) {
      const groups = statusGroup.split(',').map(Number).filter(n => !isNaN(n));
      if (groups.length > 0) {
        query += ` AND status_group IN (${groups.map((_, i) => `$${params.length + i + 1}`).join(',')})`;
        params.push(...groups);
      }
    }
    if (teamId) {
      const tid = Number(teamId);
      if (!isNaN(tid)) {
        query += ` AND (home_competitor_id = $${params.length + 1} OR away_competitor_id = $${params.length + 1})`;
        params.push(tid);
      }
    }

    if (!statusGroup || statusGroup === '2') {
      query += ' AND (status_group != 2 OR start_time > NOW() - INTERVAL \'3 hours\')';
    }

    query += ' ORDER BY start_time DESC';

    const { rows } = await pool.query(query, params);
    let games = rows.map(r => r.data);

    if (stage) {
      const q = stage.toLowerCase();
      games = games.filter(g => (g.stageName || '').toLowerCase().includes(q));
    }

    const paged = games.slice(offset, offset + limit);
    res.json(paged.map(enrichGame));
  } catch (err) {
    next(err);
  }
}

async function getLiveMatches(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 1 ORDER BY start_time DESC',
      [COMPETITION_ID]
    );
    res.json(rows.map(r => enrichGame(r.data)));
  } catch (err) {
    next(err);
  }
}

async function getFeaturedMatch(req, res, next) {
  try {
    const { rows: live } = await pool.query(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 1 LIMIT 1',
      [COMPETITION_ID]
    );
    if (live.length) return res.json(enrichGame(live[0].data));

    const { rows: upcoming } = await pool.query(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 2 AND start_time > NOW() - INTERVAL \'3 hours\' ORDER BY start_time ASC LIMIT 1',
      [COMPETITION_ID]
    );
    if (upcoming.length) return res.json(enrichGame(upcoming[0].data));

    const { rows: recent } = await pool.query(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 4 ORDER BY start_time DESC LIMIT 1',
      [COMPETITION_ID]
    );
    res.json(recent.length ? enrichGame(recent[0].data) : null);
  } catch (err) {
    next(err);
  }
}

async function getMatchById(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Preferir game_overviews (tiene datos mas ricos: lineups, predictions, etc.).
    const { rows } = await pool.query('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
    if (rows.length) {
      const game = rows[0].data?.game;
      if (game) return res.json(enrichGame(game));
    }

    // Fallback a la tabla games: cubre los partidos que todavia no tienen
    // overview sincronizado (la mayoria). games.data ya esta en formato crudo
    // de 365scores (homeCompetitor/awayCompetitor), enrichGame lo normaliza.
    const { rows: gameRows } = await pool.query('SELECT data FROM games WHERE id = $1', [gid]);
    if (gameRows.length && gameRows[0].data) {
      return res.json(enrichGame(gameRows[0].data));
    }

    res.status(404).json({ error: 'Partido no encontrado' });
  } catch (err) {
    next(err);
  }
}

async function getMatchStats(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Necesitamos los competitorIds del partido para saber cual es home/away.
    const { rows: gameRows } = await pool.query('SELECT data FROM games WHERE id = $1', [gid]);
    const gameData = gameRows[0]?.data;
    const homeId = gameData?.homeCompetitor?.id ?? gameData?.homeCompetitorId;
    const awayId = gameData?.awayCompetitor?.id ?? gameData?.awayCompetitorId;

    // 1. Intentar cache en game_stats (populado por syncLiveStats).
    const { rows } = await pool.query('SELECT data FROM game_stats WHERE game_id = $1', [gid]);
    const flat = rows[0]?.data?.statistics || rows[0]?.data?.stats || [];
    if (flat.length) {
      const stats = pivotStats(flat, homeId, awayId);
      if (stats.length) return res.json(stats);
    }

    // 2. Fallback: fetch en vivo a 365scores. El sync de stats solo corre para
    // partidos en vivo, asi que los finalizados/historicos no estan en cache.
    try {
      const live = await scores365.getGameStats(gid);
      const liveFlat = live?.statistics || [];
      if (liveFlat.length) return res.json(pivotStats(liveFlat, homeId, awayId));
    } catch (_) {
      // Si la API falla, continuamos al vacio.
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

    const { rows } = await pool.query('SELECT data FROM game_h2h WHERE game_id = $1', [gid]);
    if (!rows.length) return res.json({ recentGames: [], h2hGames: [] });

    const doc = rows[0].data;
    const result = { recentGames: [], h2hGames: [] };
    if (doc?.game?.homeCompetitor?.recentGames) {
      result.recentGames = doc.game.homeCompetitor.recentGames.map(enrichGame);
    }
    if (doc?.game?.awayCompetitor?.recentGames) {
      result.recentGames = [...result.recentGames, ...doc.game.awayCompetitor.recentGames.map(enrichGame)];
    }
    if (doc?.game?.h2hGames) {
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

    // Necesitamos los competitorIds del partido para separar home/away.
    const { rows: gameRows } = await pool.query('SELECT data FROM games WHERE id = $1', [gid]);
    const gameData = gameRows[0]?.data;
    const homeId = gameData?.homeCompetitor?.id ?? gameData?.homeCompetitorId;
    const awayId = gameData?.awayCompetitor?.id ?? gameData?.awayCompetitorId;

    // 1. Intentar tabla dedicada game_lineups (endpoint /web/athletes/games/lineups
    //    que trae names, athleteIds, imageVersion, stats por jugador).
    const { rows } = await pool.query('SELECT data FROM game_lineups WHERE game_id = $1', [gid]);
    if (rows.length) {
      const built = buildLineups(rows[0].data, homeId, awayId);
      if (built) return res.json(built);
    }

    // 2. Fallback a la API en vivo.
    try {
      const live = await scores365.getGameLineups(gid);
      const built = buildLineups(live, homeId, awayId);
      if (built) return res.json(built);
    } catch (_) { /* fallthrough */ }

    // 3. Último recurso: overview (members sin nombres completos).
    const { rows: ovRows } = await pool.query('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
    const game = ovRows[0]?.data?.game;
    if (game) {
      const home = extractLineup(game.homeCompetitor);
      const away = extractLineup(game.awayCompetitor);
      const lineups = { home, away };
      if (home || away) return res.json(lineups);
    }

    res.json(null);
  } catch (err) {
    next(err);
  }
}

async function getMatchPreStats(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const { rows } = await pool.query('SELECT data FROM game_pre_stats WHERE game_id = $1', [gid]);
    if (!rows.length) return res.json([]);

    const apiData = rows[0].data;
    if (!apiData?.statistics?.length) return res.json([]);

    const byTeam = {};
    apiData.statistics.forEach(s => {
      const cid = s.competitorId;
      if (!cid) return;
      if (!byTeam[cid]) byTeam[cid] = [];
      byTeam[cid].push({ name: s.name, value: s.value, group: s.statisticGroup || 1 });
    });

    const teamIds = Object.keys(byTeam);
    const result = {
      teamStats: teamIds.map(cid => ({
        competitorId: Number(cid),
        stats: byTeam[cid],
      })),
    };
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getMatchTips(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const { rows } = await pool.query(
      'SELECT data FROM trends WHERE scope = $1 AND game_id = $2',
      ['game', gid]
    );
    const allTrends = rows.map(r => enrichTrend(r.data));
    const topTrends = allTrends.slice(0, 5);

    const tip = {
      gameId: gid,
      confidenceScore: topTrends.length > 0 ? Math.round(topTrends.reduce((s, t) => s + (t.percentage || 0), 0) / topTrends.length) : 0,
      generatedAt: new Date().toISOString(),
      topTrends,
      allTrends,
    };
    res.json(tip);
  } catch (err) {
    next(err);
  }
}

async function getMatchTrends(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const { rows } = await pool.query(
      'SELECT data FROM trends WHERE scope = $1 AND game_id = $2',
      ['game', gid]
    );
    const trends = rows.map(r => r.data);
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

// Helper: mapear predictions del formato 365scores al del frontend.
// El HAR muestra que cada option tiene { name, vote: { count, percentage } },
// NO { text, percentage, voteCount }. totalVotes puede faltar y calcularse.
function mapPredictions(predictions) {
  return (predictions || [])
    .map(p => {
      const options = (p.options || [])
        .map(o => {
          const vote = o.vote || {};
          const voteCount = vote.count ?? o.voteCount ?? 0;
          const pct = typeof vote.percentage === 'number'
            ? vote.percentage
            : typeof o.percentage === 'number'
              ? o.percentage
              : (p.totalVotes && voteCount ? (voteCount / p.totalVotes * 100) : 0);
          return {
            text: o.text || o.name || '',
            percentage: pct,
            voteCount,
          };
        })
        .filter(o => o.text); // sin texto no aporta y rompe el render
      const totalVotes = p.totalVotes ?? options.reduce((s, o) => s + o.voteCount, 0);
      return { title: p.title || '', totalVotes, options };
    })
    .filter(p => p.options.length > 0);
}

async function getMatchPredictions(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // 1. Cache en game_overviews.
    const { rows } = await pool.query('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
    const pp = rows[0]?.data?.game?.promotedPredictions;
    if (pp?.predictions?.length) {
      const mapped = mapPredictions(pp.predictions);
      if (mapped.length) return res.json(mapped);
    }

    // 2. Fallback a la API en vivo.
    try {
      const overview = await scores365.getGameOverview(gid);
      const livePp = overview?.game?.promotedPredictions;
      if (livePp?.predictions?.length) {
        const mapped = mapPredictions(livePp.predictions);
        if (mapped.length) return res.json(mapped);
      }
    } catch (_) { /* fallthrough */ }

    res.json([]);
  } catch (err) {
    next(err);
  }
}

async function getMatchTimeline(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const { rows } = await pool.query('SELECT data FROM game_stats WHERE game_id = $1', [gid]);
    const liveEvents = rows[0]?.data?.timeline || rows[0]?.data?.events || [];

    const { rows: overviewRows } = await pool.query('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
    const chartEvents = overviewRows[0]?.data?.game?.chartEvents?.events || [];

    const events = liveEvents.length ? liveEvents : chartEvents;
    const data = events.map(e => ({
      minute: e.minute || e.matchTime || e.time,
      type: e.type === 1 ? 'goal' : e.type === 2 ? 'yellow_card' : e.type === 3 ? 'red_card' : (e.subType ? 'shot' : 'event'),
      teamId: e.teamId || e.competitorId,
      playerId: e.playerId,
      playerName: e.playerName || e.player?.name,
      description: e.description || e.text || e.goalDescription,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getMatchSuggestions(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const { rows } = await pool.query('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
    if (!rows.length) return res.json([]);

    const game = rows[0].data?.game;
    if (!game) return res.json([]);

    const predictions = game.promotedPredictions?.predictions || [];
    const data = predictions.map(p => {
      const totalVotes = (p.options || []).reduce((acc, o) => acc + (o.vote?.count || 0), 0);
      return {
        id: p.id,
        type: p.type,
        title: p.title,
        totalVotes,
        options: (p.options || []).map(o => ({
          name: o.name,
          num: o.num,
          count: o.vote?.count || 0,
          percentage: o.vote?.percentage ?? null,
        })),
      };
    });
    res.json(data);
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
