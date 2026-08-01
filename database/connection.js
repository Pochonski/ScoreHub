require('dotenv').config();
const { Pool } = require('pg');

/**
 * pg pool — kept for advanced SQL only (CTEs, transactions, multi-row INSERTs
 * that PostgREST can't express). With Supabase JS HTTP (database/db.js)
 * the bulk of traffic no longer goes through this pool, so we keep the
 * upper bound conservative.
 *
 * Phase 4 of the refactor plan: most queries now use Supabase HTTP instead.
 * This pool stays for queries like the CTE in transfers summary or the
 * multi-row INSERTs in syncService. max=1 keeps us safe against Supavisor's
 * 15-connection limit even when multiple Vercel serverless instances are
 * hot concurrently (15 instances × 1 connection each = within budget).
 */
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '1', 10),
  idleTimeoutMillis: 60000,
  maxUses: 100,
  // 5s era muy agresivo para Supabase/Supavisor (red intermitente);
  // subido a 15s y añadido retry en pgQueryRetry() abajo.
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT_MS || '15000', 10),
  statement_timeout: 30000,
  query_timeout: 30000,
  // Permitir keepalive TCP para detectar conexiones muertas por Supavisor/NAT.
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000,
  application_name: 'scorehub-pg-fallback',
};

if (process.env.SUPABASE_DB_URL) {
  poolConfig.connectionString = process.env.SUPABASE_DB_URL;
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432', 10);
  poolConfig.user = process.env.DB_USER || 'postgres';
  poolConfig.password = process.env.DB_PASSWORD || '';
  poolConfig.database = process.env.DB_NAME || 'postgres';
  poolConfig.ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  // No relanzar: un cliente idle muriendo no debe tumbar el proceso.
  // pg.Pool ya libera el cliente internamente; solo lo logueamos.
  console.error('Pool error (idle client):', err.message);
});

/**
 * pgQueryRetry(sql, params, opts) — ejecuta una query con reintentos
 * para errores transitorios (timeout de conexión, connection terminated).
 *
 * El sync ve timeouts intermitentes hacia Supabase/Supavisor cuando:
 * - La conexión idle fue cerrada por el proxy (NAT, Supavisor pooler)
 * - Hay un pico de latencia en la red
 *
 * En lugar de propagar el error y tumbar el job, reintentamos 2 veces
 * con backoff corto (250ms, 750ms) y luego propagamos si sigue fallando.
 *
 * Errores que NO se reintentan: constraint violations, syntax errors, etc.
 * (cualquier cosa que no sea de red).
 */
async function pgQueryRetry(sql, params, opts = {}) {
  const { retries = 2, baseDelayMs = 250 } = opts;
  const retryableCodes = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPIPE',
  ]);
  const retryableMessages = [
    'timeout exceeded when trying to connect',
    'Connection terminated unexpectedly',
    'connection terminated',
    'Connection terminated',
    'server closed the connection unexpectedly',
    'Connection ended',
  ];

  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      lastErr = err;
      const isRetryable =
        retryableCodes.has(err.code) ||
        retryableMessages.some(m => err.message?.includes(m));
      if (!isRetryable || attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(3, attempt);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    const r = await client.query('SELECT NOW() as now, current_database() as db');
    console.log(`Database connected (${r.rows[0].db}) @ ${r.rows[0].now.toISOString()}`);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  } finally {
    if (client) client.release();
  }
}

/**
 * Run `fn(client)` inside a BEGIN/COMMIT transaction. If `fn` throws,
 * the transaction is rolled back and the error propagates. The pooled
 * client is always released.
 *
 * Use for any multi-statement write that must be atomic (e.g. a
 * DELETE followed by INSERT where partial failure would leave the cache
 * half-populated).
 *
 * Example:
 *   await withTransaction(async (client) => {
 *     await client.query('DELETE FROM foo WHERE scope = $1', [scope]);
 *     await client.query('INSERT INTO foo (...) VALUES (...)', [...]);
 *   });
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('withTransaction: rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection, withTransaction, pgQueryRetry };
