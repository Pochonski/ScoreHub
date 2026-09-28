/**
 * jobGuard.js — Mutex por nombre para evitar solapamiento de tareas periódicas.
 *
 * node-cron no salta ejecuciones si la anterior sigue corriendo. Para crons
 * frecuentes (15s, 60s) y llamadas a APIs externas que pueden tardar más que
 * el intervalo, esto evita acumular instancias del mismo job y saturar la DB
 * o el upstream.
 *
 * Uso:
 *   const guard = require('../utils/jobGuard');
 *   cron.schedule(every15secs, guard.wrap('syncLiveGames', sync.syncLiveGames));
 *
 * Si una corrida lanza, se loguea el error y el guard se libera (gracias al
 * finally). El error no se propaga al caller para no romper node-cron.
 */
const running = new Map();

function isRunning(name) {
  return running.get(name) === true;
}

/**
 * Recorder por defecto: upsert a sync_health (migración 027). Lazy-require
 * para no crear ciclos (database/db no importa jobGuard, pero así queda
 * blindado) y fire-and-forget: un fallo de heartbeat jamás tumba el job.
 */
function defaultHeartbeatRecorder({ name, ok, errMsg, durationMs }) {
  try {
    const db = require('../database/db');
    Promise.resolve(
      db.upsert(
        'sync_health',
        {
          job_name: name,
          last_run_at: new Date().toISOString(),
          last_ok: ok,
          last_error: errMsg ? String(errMsg).slice(0, 500) : null,
          last_duration_ms: durationMs,
        },
        'job_name'
      )
    ).catch(() => {});
  } catch {}
}

/**
 * Envuelve un handler async para que no se solape consigo mismo.
 *
 * opts.recordHeartbeat: fn({name, ok, errMsg, durationMs}) para tests.
 * Por defecto registra en sync_health, EXCEPTO en NODE_ENV=test (para no
 * abrir conexiones pg en unit tests).
 */
function wrap(name, fn, opts = {}) {
  return async (...args) => {
    if (running.get(name)) {
      console.warn(`[jobGuard] "${name}" saltada: ya en curso`);
      return;
    }
    running.set(name, true);
    const started = Date.now();
    const record =
      opts.recordHeartbeat !== undefined
        ? opts.recordHeartbeat
        : process.env.NODE_ENV === 'test'
          ? null
          : defaultHeartbeatRecorder;
    // El heartbeat jamás rompe el job: ni un recorder custom que lance.
    const heartbeat = (payload) => {
      try {
        const r = record ? record(payload) : null;
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {}
    };
    try {
      await fn(...args);
      heartbeat({ name, ok: true, errMsg: null, durationMs: Date.now() - started });
    } catch (e) {
      console.error(`[jobGuard] "${name}" falló:`, e.message);
      heartbeat({ name, ok: false, errMsg: e.message, durationMs: Date.now() - started });
    } finally {
      running.set(name, false);
    }
  };
}

module.exports = { wrap, isRunning };
