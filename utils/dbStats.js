/**
 * utils/dbStats.js
 *
 * Lightweight in-process counter that tracks how many DB calls go through
 * Supabase HTTP vs the pg pool. Exposed via /api/football/health so we can
 * verify that the migration is moving traffic off the connection-limited
 * pg path.
 *
 * Counters reset when the process restarts. Fine for health checks,
 * not for cross-process totals.
 */

const counters = {
  supabaseCalls: 0,
  supabaseErrors: 0,
  pgCalls: 0,
  pgErrors: 0,
  // Fase 8.4: contadores para write-back automático vía readThrough().
  upsertsFromCacheMiss: 0,
  readThroughCalls: 0,
  startedAt: new Date().toISOString(),
};

function recordSupabaseCall() {
  counters.supabaseCalls++;
}
function recordSupabaseError() {
  counters.supabaseErrors++;
}
function recordPgCall() {
  counters.pgCalls++;
}
function recordPgError() {
  counters.pgErrors++;
}
/**
 * Fase 8.4: un write-back automático ocurrió (cache miss → fetch 365 → upsert DB).
 * Útil para verificar en /api/football/health que los endpoints DB_FIRST
 * realmente están hidratando la DB.
 */
function recordUpsertFromCacheMiss() {
  counters.upsertsFromCacheMiss++;
  // readThroughCalls se incrementa en cada llamada a readThrough
  // (en database/db.js), no solo en write-backs.
}
function recordReadThroughHit() {
  counters.readThroughCalls++;
}

function getStats() {
  const total = counters.supabaseCalls + counters.pgCalls;
  return {
    ...counters,
    totalCalls: total,
    supabasePercent: total ? Math.round((counters.supabaseCalls / total) * 100) : 0,
    pgPercent: total ? Math.round((counters.pgCalls / total) * 100) : 0,
  };
}

function reset() {
  counters.supabaseCalls = 0;
  counters.supabaseErrors = 0;
  counters.pgCalls = 0;
  counters.pgErrors = 0;
  counters.upsertsFromCacheMiss = 0;
  counters.readThroughCalls = 0;
  counters.startedAt = new Date().toISOString();
}

module.exports = {
  recordSupabaseCall,
  recordSupabaseError,
  recordPgCall,
  recordPgError,
  recordUpsertFromCacheMiss,
  recordReadThroughHit,
  getStats,
  reset,
};
