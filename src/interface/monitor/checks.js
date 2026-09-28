/**
 * src/interface/monitor/checks.js — Checks puros del monitor (Fase monitoreo-2026).
 *
 * Funciones de evaluación sin side-effects (testeables) + adaptadores que
 * leen DB/red. El orquestador está en monitor.js.
 */

const DEFAULT_MAX_STALE_MS = {
  syncLiveGames: 10 * 60 * 1000,
  syncLiveStats: 10 * 60 * 1000,
  syncResultsFixtures: 45 * 60 * 1000,
  syncStandings: 45 * 60 * 1000,
  syncBetSelections: 20 * 60 * 1000,
  syncTrendsOdds: 3 * 3600 * 1000,
  syncContent: 3 * 3600 * 1000,
  syncAthletes: 8 * 3600 * 1000,
  syncTransfers: 12 * 3600 * 1000,
  syncCatalog: 30 * 3600 * 1000,
};

/**
 * Evalúa heartbeats contra la staleness máxima.
 * rows: [{job_name, last_run_at, last_ok, last_error}]
 * Retorna issues: [{key, job, severity: 'critical'|'warning', detail}]
 * - missing: el job nunca reportó (daemon caído o job nuevo).
 * - error: última corrida falló.
 * - stale: supera su ventana (daemon colgado o cron detenido).
 */
function evaluateFreshness(rows, maxStaleMs = DEFAULT_MAX_STALE_MS, now = Date.now()) {
  const byJob = new Map((rows || []).map((r) => [r.job_name, r]));
  const issues = [];
  for (const [job, maxAge] of Object.entries(maxStaleMs)) {
    const row = byJob.get(job);
    if (!row || !row.last_run_at) {
      issues.push({ key: `sync:${job}`, job, severity: 'warning', detail: 'sin heartbeat (job nunca reportó)' });
      continue;
    }
    const age = now - new Date(row.last_run_at).getTime();
    if (row.last_ok === false) {
      issues.push({
        key: `sync:${job}`, job, severity: 'critical',
        detail: `última corrida falló: ${(row.last_error || 'sin detalle').slice(0, 160)}`,
      });
      continue;
    }
    if (Number.isFinite(age) && age > maxAge) {
      issues.push({
        key: `sync:${job}`, job, severity: 'critical',
        detail: `stale hace ${Math.round(age / 60000)}min (máx ${Math.round(maxAge / 60000)}min)`,
      });
    }
  }
  return issues;
}

/** Ping a DB con latencia. Nunca lanza: devuelve {ok, latencyMs, error}. */
async function pingDb() {
  const started = Date.now();
  try {
    const { pool } = require('../../../database/connection');
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, error: e.message };
  }
}

/** Lee heartbeats. Nunca lanza: devuelve [] si falla. */
async function readHeartbeats() {
  try {
    const db = require('../../../database/db');
    const rows = await db.execAdvanced(
      'SELECT job_name, last_run_at, last_ok, last_error FROM sync_health'
    );
    return rows;
  } catch {
    return [];
  }
}

/**
 * Egress de Supabase (best-effort).
 * Requiere SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF y, como el
 * endpoint de usage cambia entre versiones de la API, permite override
 * total con SUPABASE_USAGE_URL (ver .env.example). Si no está configurado
 * o falla → { skipped: true } (el resto del monitoreo sigue funcionando).
 */
async function checkEgress({ fetchFn = globalThis.fetch } = {}) {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN || '';
  const ref = process.env.SUPABASE_PROJECT_REF || '';
  if (!token || !ref) return { skipped: true, reason: 'sin SUPABASE_MANAGEMENT_TOKEN/PROJECT_REF' };
  const url =
    process.env.SUPABASE_USAGE_URL ||
    `https://api.supabase.com/v1/projects/${ref}/usage/api`;
  try {
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { skipped: true, reason: `usage API HTTP ${res.status}` };
    const body = await res.json();
    // Forma esperada (si el endpoint difiere, se reporta y se ignora):
    // { used_gb, limit_gb } o { db_egress_gb, ... }. Se buscan claves conocidas.
    const used = body.used_gb ?? body.db_egress_gb ?? body.egress_gb ?? null;
    const limit = body.limit_gb ?? body.egress_limit_gb ?? null;
    if (typeof used !== 'number' || typeof limit !== 'number' || !limit) {
      return { skipped: true, reason: 'forma de usage no reconocida' };
    }
    return { skipped: false, usedGb: used, limitGb: limit, pct: used / limit };
  } catch (e) {
    return { skipped: true, reason: e.message };
  }
}

module.exports = { DEFAULT_MAX_STALE_MS, evaluateFreshness, pingDb, readHeartbeats, checkEgress };
