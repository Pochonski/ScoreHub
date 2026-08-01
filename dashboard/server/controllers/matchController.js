const { pool } = require('../../../database/connection');
const db = require('../../../database/db');

/**
 * Helper: SELECT data FROM <table> WHERE <keyCol> = $1.
 *
 * Most detail tables (game_overviews, game_stats, game_lineups, ...)
 * use `game_id` as the FK column. The `games` table IS the game, so
 * its primary key is `id` (not `game_id`).
 *
 * Returns the row's `data` JSONB content (the wrapper returns
 * `{data: ..., error: ...}` but at the row level `data` is the JSONB column).
 * Callers downstream should treat the result as the legacy
 * `rows[0].data` from pool.query.
 */
async function getGameDetailBy(table, gameId) {
  const keyCol = table === 'games' ? 'id' : 'game_id';
  const { data, error } = await db.query(table, {
    select: 'data',
    eq: { [keyCol]: Number(gameId) },
    maybeSingle: true,
  });
  if (error) throw error;
  // Wrapper shape: { data: { data: <jsonb> } } (because column is named 'data').
  return data?.data ?? null;
}
const scores365 = require('../../../services/scores365Service');
const { enrichGame, enrichTrend, extractLineup, buildLineups, buildMatchupId, SCORE_STAT_IDS, MAJOR_STAT_IDS } = require('../utils/mappers');
const { resolveCompetition, resolveCompetitionIds } = require('../utils/competition');

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
    const { statusGroup, stage, teamId, all, seasonNum: seasonNumQ } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    // Modo "all" devuelve partidos de todas las competiciones activas
    // (útil para la home multi-comp con tab "Todas").
    let compIds;
    let defaultSeasonNum = null;
    if (all === 'true') {
      compIds = await resolveCompetitionIds(req, res);
      if (compIds === null) return;
    } else {
      const resolved = await resolveCompetition(req, res);
      if (!resolved) return;
      compIds = [resolved.competitionId];
      defaultSeasonNum = resolved.seasonNum;
    }

    let query = 'SELECT data FROM games WHERE competition_id = ANY($1::int[])';
    const params = [compIds];

    // Filtro de temporada: ?seasonNum=X fuerza una temporada concreta;
    // por defecto usamos la temporada activa de la comp. Pasar
    // ?seasonNum=all desactiva el filtro (todas las temporadas).
    let filterSeasonNum = defaultSeasonNum;
    if (seasonNumQ != null) {
      if (seasonNumQ === 'all') {
        filterSeasonNum = null;
      } else {
        const parsed = parseInt(seasonNumQ, 10);
        if (Number.isFinite(parsed)) filterSeasonNum = parsed;
      }
    }
    if (filterSeasonNum != null) {
      query += ` AND (data->>'seasonNum')::int = $${params.length + 1}`;
      params.push(filterSeasonNum);
    }

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

    // Ordenar por fecha lógica según el filtro de estado:
    //   - upcoming (2) o sin filtro → próximos primero (ASC)
    //   - live (1) → en vivo primero, después por inicio (ASC)
    //   - finished (4) o combinaciones → más recientes primero (DESC)
    const hasUpcoming = !statusGroup || statusGroup.split(',').map(Number).includes(2);
    const hasLive = statusGroup && statusGroup.split(',').map(Number).includes(1);
    const hasFinished = statusGroup && statusGroup.split(',').map(Number).includes(4);
    const onlyLive = hasLive && !hasUpcoming && !hasFinished;
    const onlyFinished = hasFinished && !hasUpcoming && !hasLive;
    if (onlyFinished) {
      query += ' ORDER BY start_time DESC';
    } else if (onlyLive) {
      query += " ORDER BY status_group ASC, start_time ASC";
    } else {
      // upcoming o mixto: próximos primero
      query += ' ORDER BY start_time ASC';
    }

    const rows = await db.execAdvanced(query, params);
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
    const { all } = req.query;
    let compIds;
    if (all === 'true') {
      compIds = await resolveCompetitionIds(req, res);
      if (compIds === null) return;
    } else {
      const resolved = await resolveCompetition(req, res);
      if (!resolved) return;
      compIds = [resolved.competitionId];
    }
    const liveRows = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = ANY($1::int[]) AND status_group = 1 ORDER BY start_time DESC',
      [compIds]
    );
    res.json(liveRows.map(r => enrichGame(r.data)));
  } catch (err) {
    next(err);
  }
}

async function getFeaturedMatch(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const cid = resolved.competitionId;

    const live = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 1 LIMIT 1',
      [cid]
    );
    if (live.length) return res.json(enrichGame(live[0].data));

    const upcoming = await db.execAdvanced(
      `SELECT data FROM games WHERE competition_id = $1 AND status_group = 2
         AND start_time > NOW() - INTERVAL '3 hours'
         ORDER BY start_time ASC LIMIT 1`,
      [cid]
    );
    if (upcoming.length) return res.json(enrichGame(upcoming[0].data));

    const recent = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 4 ORDER BY start_time DESC LIMIT 1',
      [cid]
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
    const overview = await getGameDetailBy('game_overviews', gid);
    if (overview?.game) {
      return res.json(enrichGame(overview.game));
    }

    // Fallback a la tabla games: cubre los partidos que todavia no tienen
    // overview sincronizado (la mayoria). games.data ya esta en formato crudo
    // de 365scores (homeCompetitor/awayCompetitor), enrichGame lo normaliza.
    // games has `id` (not `game_id`) — handled by getGameDetailBy.
    const gameJsonb = await getGameDetailBy('games', gid);
    if (gameJsonb) {
      return res.json(enrichGame(gameJsonb));
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

    const gameRow = await getGameDetailBy('games', gid);
    const gameData = gameRow?.data;
    const homeId = gameData?.homeCompetitor?.id ?? gameData?.homeCompetitorId;
    const awayId = gameData?.awayCompetitor?.id ?? gameData?.awayCompetitorId;

    // DB-first con write-back (Fase 8.4).
    const { data: statsRow, source } = await db.readThrough(
      'game_stats',
      { select: 'data', eq: { game_id: gid }, maybeSingle: true },
      async () => {
        const live = await scores365.getGameStats(gid);
        if (!live?.statistics?.length) return null;
        return { game_id: gid, data: JSON.stringify(live) };
      },
      { onConflict: 'game_id', ttlMs: 30 * 1000 },
    );

    if (source !== '365-error' && statsRow) {
      const flat = statsRow?.statistics || statsRow?.stats || [];
      if (flat.length) {
        const stats = pivotStats(flat, homeId, awayId);
        if (stats.length) return res.json(stats);
      }
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

    const row = await getGameDetailBy('game_h2h', gid);
    if (!row?.data) return res.json({ recentGames: [], h2hGames: [] });

    const doc = row.data;
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

    const gameRow = await getGameDetailBy('games', gid);
    const gameData = gameRow?.data;
    const homeId = gameData?.homeCompetitor?.id ?? gameData?.homeCompetitorId;
    const awayId = gameData?.awayCompetitor?.id ?? gameData?.awayCompetitorId;

    // DB-first con write-back (Fase 8.4).
    const { data: lineupsRow } = await db.readThrough(
      'game_lineups',
      { select: 'data', eq: { game_id: gid }, maybeSingle: true },
      async () => {
        const live = await scores365.getGameLineups(gid);
        if (!live) return null;
        return { game_id: gid, data: JSON.stringify(live) };
      },
      { onConflict: 'game_id', ttlMs: 60 * 60 * 1000 },
    );

    if (lineupsRow?.data) {
      const built = buildLineups(lineupsRow.data, homeId, awayId);
      if (built) return res.json(built);
    }

    // Fallback: extraer de game_overviews (que ya está cacheado).
    const ovRow = await getGameDetailBy('game_overviews', gid);
    const game = ovRow?.game;
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

    const row = await getGameDetailBy('game_pre_stats', gid);
    if (!row?.data) return res.json([]);

    const apiData = row.data;
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

    // Los trends de 365scores se guardan con dos scopes:
    //  - 'game': feed por partido (games=<id>) → TODOS los tips del partido
    //    (ganador, over/under, ambos marcan, primer gol…). Es el rico.
    //  - 'competition': feed de la comp con isTop=true → solo el trend "top"
    //    por partido (uno, a veces duplicado). Fallback.
    // Preferimos game-level; si no hay, usamos competition-level.
    const rows = await db.execAdvanced(
      `SELECT data, scope FROM trends
        WHERE game_id = $1
          AND scope IN ('competition', 'game')
        ORDER BY (data->>'percentage')::numeric DESC NULLS LAST
        LIMIT 50`,
      [gid]
    );
    const gameRows = rows.filter(r => r.scope === 'game');
    const source = gameRows.length ? gameRows : rows;

    // Dedup por apuesta (betCTA/text + lineTypeId), quedándose con el % más alto.
    const byBet = new Map();
    for (const r of source.map(x => enrichTrend(x.data))) {
      const key = `${r.betCTA || r.text}|${r.lineTypeId}`;
      const cur = byBet.get(key);
      if (!cur || (r.percentage || 0) > (cur.percentage || 0)) byBet.set(key, r);
    }
    const allTrends = Array.from(byBet.values()).sort(
      (a, b) => (b.percentage || 0) - (a.percentage || 0)
    );
    const topTrends = allTrends.slice(0, 6);

    const tip = {
      gameId: gid,
      // Fracción 0-1 (el frontend la multiplica por 100). No redondear a
      // entero aquí — colapsaba a 0/1 (bug: "100% confianza" siempre).
      confidenceScore:
        topTrends.length > 0
          ? topTrends.reduce((s, t) => s + (t.percentage || 0), 0) / topTrends.length
          : 0,
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

    const rows = await db.execAdvanced(
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
        .filter(o => o.text);
      const totalVotes = p.totalVotes ?? options.reduce((s, o) => s + o.voteCount, 0);
      return { title: p.title || '', totalVotes, options };
    })
    .filter(p => p.options.length > 0);
}

async function getMatchPredictions(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // Fase 8.6: predictions se guardan en la tabla `predictions` (sincronizadas
    // por syncPredictions). Estructura: `data` es el game completo de la API
    // (`getPredictions`), con `promotedPredictions.predictions[]`.
    // Primero leemos de `predictions` (más actualizado y específico), luego
    // fallback a `game_overviews` (que también tiene promotedPredictions
    // dentro de `data.game.promotedPredictions`).
    const { data: predRow } = await db.readThrough(
      'predictions',
      { select: 'data', eq: { game_id: gid }, maybeSingle: true },
      async () => {
        const data = await scores365.getPredictions(1);
        const game = (data?.games ?? []).find(g => Number(g.id) === gid);
        if (!game) return null;
        return { game_id: gid, data: JSON.stringify(game) };
      },
      { onConflict: 'game_id', ttlMs: 5 * 60 * 1000 },
    );

    const pp = predRow?.data?.promotedPredictions;
    if (pp?.predictions?.length) {
      const mapped = mapPredictions(pp.predictions);
      if (mapped.length) return res.json(mapped);
    }

    // Fallback: game_overviews
    const { data: row } = await db.readThrough(
      'game_overviews',
      { select: 'data', eq: { game_id: gid }, maybeSingle: true },
      async () => {
        const overview = await scores365.getGameOverview(gid);
        if (!overview) return null;
        return { game_id: gid, data: JSON.stringify(overview) };
      },
      { onConflict: 'game_id', ttlMs: 30 * 60 * 1000 },
    );

    const ovPp = row?.game?.promotedPredictions;
    if (ovPp?.predictions?.length) {
      const mapped = mapPredictions(ovPp.predictions);
      if (mapped.length) return res.json(mapped);
    }

    res.json([]);
  } catch (err) {
    next(err);
  }
}

const EVENT_TYPE_MAP = {
  1: 'goal',
  2: 'yellow_card',
  3: 'red_card',
  1000: 'substitution',
};

async function getMatchTimeline(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    // DB-first con write-back (Fase 8.4).
    const { data: ovRow } = await db.readThrough(
      'game_overviews',
      { select: 'data', eq: { game_id: gid }, maybeSingle: true },
      async () => {
        const overview = await scores365.getGameOverview(gid);
        if (!overview) return null;
        return { game_id: gid, data: JSON.stringify(overview) };
      },
      { onConflict: 'game_id', ttlMs: 30 * 1000 },
    );

    const rawEvents = ovRow?.game?.events || [];
    if (!rawEvents.length) return res.json([]);

    const playerIds = [...new Set(rawEvents.flatMap(e => [e.playerId, ...(e.extraPlayers || [])]).filter(Boolean))];
    const playerNameMap = {};
    if (playerIds.length) {
      const playerRows = await db.execAdvanced(
        `SELECT id, data->>'name' as name FROM athletes WHERE id = ANY($1::bigint[])`,
        [playerIds]
      );
      for (const r of playerRows) playerNameMap[r.id] = r.name;
    }

    const data = rawEvents
      .map(e => {
        const type = EVENT_TYPE_MAP[e.eventType?.id] || 'event';
        const playerName = playerNameMap[e.playerId] || '';
        const subIn = e.extraPlayers?.[0];
        const subInName = subIn ? playerNameMap[subIn] : '';
        let description = '';
        if (type === 'substitution' && subInName) {
          description = `${playerName} ➡️ ${subInName}`;
        } else if (playerName) {
          description = playerName;
        }
        return {
          minute: e.gameTime ?? 0,
          type,
          teamId: e.competitorId,
          playerId: e.playerId,
          playerName,
          description,
          isMajor: Boolean(e.isMajor),
        };
      })
      .sort((a, b) => a.minute - b.minute);

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getMatchSuggestions(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);

    const row = await getGameDetailBy('game_overviews', gid);
    if (!row?.data) return res.json([]);

    const game = row?.game;
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
