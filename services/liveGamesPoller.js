require('dotenv').config();
const cron = require('node-cron');

const api = require('./scores365Service');
const { pool } = require('../database/connection');
const { forEachActive } = require('./syncCompetitions');
const notifier = require('./notifier');
const logger = require('../utils/logger');

const POLL_MS = parseInt(process.env.SCORES365_POLL_MS || '25000', 10);
const CRON_EXPR = `*/${Math.max(15, Math.floor(POLL_MS / 1000))} * * * * *`;

function now() { return new Date().toISOString(); }
function log(msg, extra) {
  if (extra) logger.info({ poller: 'live', ...extra }, msg);
  else logger.info({ poller: 'live' }, msg);
}

const previousStats = new Map();
const MAX_STATS_ENTRIES = 200;

function setPreviousStats(key, value) {
  if (previousStats.size >= MAX_STATS_ENTRIES) {
    const oldest = previousStats.keys().next().value;
    if (oldest != null) previousStats.delete(oldest);
  }
  previousStats.set(key, value);
}

async function getLastUpdateId(gameId) {
  const client = await pool.connect().catch(() => null);
  if (!client) return 0;
  try {
    const r = await client.query('SELECT last_update_id FROM scores365_state WHERE game_id = $1', [Number(gameId)]);
    return r.rows[0]?.last_update_id || 0;
  } catch (err) {
    logger.warn({ err: err.message, poller: 'live', gameId }, 'getLastUpdateId failed');
    return 0;
  } finally {
    client.release();
  }
}

async function setLastUpdateId(gameId, competitionId, lastUpdateId) {
  const client = await pool.connect().catch(() => null);
  if (!client) return;
  try {
    await client.query(`
      INSERT INTO scores365_state (game_id, competition_id, last_update_id, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (game_id)
      DO UPDATE SET last_update_id = EXCLUDED.last_update_id, updated_at = NOW()
    `, [Number(gameId), competitionId, lastUpdateId]);
  } catch (err) {
    logger.warn({ err: err.message, poller: 'live', gameId }, 'setLastUpdateId failed');
  } finally {
    client.release();
  }
}

function getStatValue(stats, id) {
  if (!stats) return null;
  for (const s of stats) {
    if (s.id === id) return parseInt(s.value) || 0;
  }
  return null;
}

function getStatValueForCompetitor(stats, id, competitorId) {
  if (!stats || competitorId == null) return null;
  for (const s of stats) {
    if (s.id === id && Number(s.competitorId) === Number(competitorId)) {
      return parseInt(s.value) || 0;
    }
  }
  return null;
}

/**
 * Detecta cambios comparando snapshots previos y nuevos.
 *
 * 365scores separa stats por `competitorId` y usa IDs para el TIPO de stat.
 * Para goles NO se usa un stat ID — el score viene como `score` en homeCompetitor/awayCompetitor.
 * Para córners sí es stat ID 8.
 *
 * Esta función ya no infiere local/visitante por el ID del stat; usa el
 * competitorId que viene explícito.
 */
function detectEvents(game, prevStats, newStats, prevScores, newScores) {
  const events = [];
  const { id: gameId } = game;
  const homeId = game.homeCompetitor?.id;
  const awayId = game.awayCompetitor?.id;

  if (!prevScores || !newScores) return events;

  if (homeId != null && prevScores.home != null && newScores.home > prevScores.home) {
    const diff = newScores.home - prevScores.home;
    for (let i = 0; i < diff; i++) {
      events.push({
        type: 'goal:scored',
        gameId,
        team: 'home',
        competitorId: homeId,
        competitionId: game.competitionId,
        score: `${newScores.home}-${newScores.away}`,
        minute: null,
      });
    }
  }

  if (awayId != null && prevScores.away != null && newScores.away > prevScores.away) {
    const diff = newScores.away - prevScores.away;
    for (let i = 0; i < diff; i++) {
      events.push({
        type: 'goal:scored',
        gameId,
        team: 'away',
        competitorId: awayId,
        competitionId: game.competitionId,
        score: `${newScores.home}-${newScores.away}`,
        minute: null,
      });
    }
  }

  if (homeId != null) {
    const prevCorners = getStatValueForCompetitor(prevStats, 8, homeId);
    const newCorners = getStatValueForCompetitor(newStats, 8, homeId);
    if (prevCorners != null && newCorners != null && newCorners > prevCorners) {
      events.push({
        type: 'corner',
        gameId,
        team: 'home',
        competitorId: homeId,
        competitionId: game.competitionId,
        minute: null,
      });
    }
  }
  if (awayId != null) {
    const prevCorners = getStatValueForCompetitor(prevStats, 8, awayId);
    const newCorners = getStatValueForCompetitor(newStats, 8, awayId);
    if (prevCorners != null && newCorners != null && newCorners > prevCorners) {
      events.push({
        type: 'corner',
        gameId,
        team: 'away',
        competitorId: awayId,
        competitionId: game.competitionId,
        minute: null,
      });
    }
  }

  return events;
}

function snapshotForGame(game) {
  return {
    stats: game._lastStatistics || [],
    homeScore: typeof game.homeCompetitor?.score === 'number' ? game.homeCompetitor.score : null,
    awayScore: typeof game.awayCompetitor?.score === 'number' ? game.awayCompetitor.score : null,
  };
}

async function pollGame(gameId) {
  const gameNumericId = Number(gameId);
  const prevEntry = previousStats.get(gameNumericId) || {};
  const prevStats = prevEntry.stats;
  const prevScores = { home: prevEntry.homeScore ?? null, away: prevEntry.awayScore ?? null };
  const prevId = await getLastUpdateId(gameNumericId);

  const data = await api.getGameStats(gameNumericId, prevId || undefined);
  const newId = data.lastUpdateId || prevId;
  const newStats = data.statistics || [];
  const homeScore = typeof data.homeCompetitor?.score === 'number' ? data.homeCompetitor.score
    : typeof data.game?.homeCompetitor?.score === 'number' ? data.game.homeCompetitor.score
    : null;
  const awayScore = typeof data.awayCompetitor?.score === 'number' ? data.awayCompetitor.score
    : typeof data.game?.awayCompetitor?.score === 'number' ? data.game.awayCompetitor.score
    : null;
  const newScores = { home: homeScore, away: awayScore };
  const competitionId = data.competitionId ?? prevEntry.competitionId ?? null;

  if (newId === prevId && prevId > 0) {
    setPreviousStats(gameNumericId, { ...prevEntry, stats: newStats, homeScore, awayScore });
    return { gameId: gameNumericId, status: 'no-change', lastUpdateId: prevId };
  }

  const gameStub = {
    id: gameNumericId,
    competitionId,
    homeCompetitor: { id: data.homeCompetitor?.id ?? prevEntry.homeId },
    awayCompetitor: { id: data.awayCompetitor?.id ?? prevEntry.awayId },
  };

  const detected = detectEvents(gameStub, prevStats, newStats, prevScores, newScores);
  setPreviousStats(gameNumericId, {
    stats: newStats,
    homeScore,
    awayScore,
    homeId: gameStub.homeCompetitor.id,
    awayId: gameStub.awayCompetitor.id,
    competitionId,
  });

  const statsCount = newStats.length;
  const filtersCount = (data.statisticsFilters || []).length;
  await setLastUpdateId(gameNumericId, competitionId, newId);

  for (const event of detected) {
    log(`  event detected: ${event.type} gameId=${gameId}`);
    try {
      notifier.emitMatchEvent(event.type, event);
    } catch (err) {
      logger.warn({ err: err.message, poller: 'live', gameId }, 'notifier.emitMatchEvent threw');
    }
  }

  return { gameId: gameNumericId, status: 'updated', lastUpdateId: newId, stats: statsCount, filters: filtersCount, events: detected.length };
}

/**
 * Devuelve la lista de partidos en vivo de TODAS las competiciones activas.
 * Antes solo consultaba el Mundial.
 */
async function listLiveGames() {
  const seen = new Set();
  const games = [];
  let lastError = null;

  await forEachActive(async (comp) => {
    try {
      const current = await api.getGamesCurrent(comp.id);
      const live = (current.games || []).filter(
        (g) => g.statusGroup === 1 || g.statusText === 'En vivo'
      );
      for (const g of live) {
        if (!seen.has(Number(g.id))) {
          seen.add(Number(g.id));
          games.push({
            ...g,
            competitionId: Number(g.competitionId || comp.id),
          });
        }
      }
    } catch (err) {
      lastError = err;
      logger.warn({ err: err.message, poller: 'live', competitionId: comp.id }, 'getGamesCurrent failed for comp');
    }
  });

  if (!games.length && lastError) {
    logger.error({ err: lastError.message, poller: 'live' }, 'all getGamesCurrent failed');
  }

  return games;
}

async function tick() {
  const liveGames = await listLiveGames();
  if (!liveGames.length) {
    log('sin juegos en vivo');
    return;
  }
  log(`polling ${liveGames.length} juegos en vivo (multi-comp)`);
  for (const g of liveGames) {
    try {
      const r = await pollGame(g.id);
      log(`  ${g.id} [comp=${g.competitionId}]: ${r.status} (${r.stats ?? 0} stats, ${r.events ?? 0} events)`);
    } catch (e) {
      logger.error({ err: e.message, poller: 'live', gameId: g.id, competitionId: g.competitionId }, 'pollGame ERROR');
    }
  }
  const liveSet = new Set(liveGames.map((g) => Number(g.id)));
  for (const key of previousStats.keys()) {
    if (!liveSet.has(key)) previousStats.delete(key);
  }
}

let scheduledTask = null;
let isRunning = false;

async function tickGuarded() {
  if (isRunning) {
    log('tick saltado: ya en curso');
    return;
  }
  isRunning = true;
  try {
    await tick();
  } catch (e) {
    logger.error({ err: e.message, poller: 'live' }, 'tick falló');
  } finally {
    isRunning = false;
  }
}

function start() {
  if (scheduledTask) return scheduledTask;
  log(`iniciando (cron: ${CRON_EXPR})`);
  scheduledTask = cron.schedule(CRON_EXPR, tickGuarded);
  tickGuarded();
  return scheduledTask;
}

function stop() {
  if (scheduledTask) scheduledTask.stop();
  scheduledTask = null;
}

if (require.main === module) {
  const { install: installProcessGuard } = require('../utils/processGuard');
  installProcessGuard({ name: 'liveGamesPoller' });
  start();
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
}

// Deprecated helper: kept for backwards compat; no longer used internally.
function getCompetitorScore(stats, competitorId, statId) {
  return getStatValueForCompetitor(stats, statId, competitorId);
}

module.exports = { start, stop, tick, pollGame, listLiveGames, previousStats, getCompetitorScore };
