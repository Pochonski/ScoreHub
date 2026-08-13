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
 * multi-row INSERTs of the sync jobs.
 *
 * IMPORTANTE (incidente de saturación de sesión): cuando la ruta HTTP de
 * Supabase NO está configurada (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY),
 * el 100% del tráfico cae a este pool. Si además SUPABASE_DB_URL apunta al
 * pooler de Supavisor en modo *sesión* (puerto 5432), el límite es de 15
 * clientes y el fan-out del dashboard (~11 requests en paralelo por carga, cada
 * uno una lambda que retiene su conexión durante `idleTimeoutMillis`) lo agota
 * → "max clients reached in session mode".
 *
 * Fixes de raíz (env de Vercel): usar el pooler en modo *transacción*
 * (puerto 6543) o activar la ruta HTTP. Mitigaciones aquí:
 *   - idleTimeoutMillis bajo → cada lambda suelta el slot rápido, no lo
 *     retiene entre requests.
 *   - pgQueryRetry reintenta ante EMAXCONNSESSION / "too many clients" con
 *     backoff, convirtiendo picos momentáneos en latencia en vez de 500.
 * Ambos son configurables por env para poder ajustarlos sin redeploy de código.
 */
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '1', 10),
  // Bajado de 60s: en serverless retener la conexión de sesión 60s tras cada
  // request mantiene ocupados los 15 slots de Supavisor. 10s libera pronto.
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '10000', 10),
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
  // Auditoría 2026-Q3 Fase 6.5: Supavisor usa certificados auto-firmados en
  // algunos pools. rejectUnauthorized: false es necesario para conectar, pero
  // significa que MITM protection depende sólo de TLS. NO exponer el puerto
  // a redes no confiadas. Para producción con CA bundle propio, agregar
  // `ca: fs.readFileSync(...)`.
  poolConfig.connectionString = process.env.SUPABASE_DB_URL;
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432', 10);
  poolConfig.user = process.env.DB_USER || 'postgres';
  // Auditoría 2026-Q3 Fase 6.4: validar DB_PASSWORD no vacío cuando se usa
  // variables individuales. Sin esto, una config rota podría intentar conectar
  // con credencial vacía y fallar silenciosamente.
  const password = process.env.DB_PASSWORD || '';
  if (!password && process.env.NODE_ENV === 'production') {
    throw new Error('DB_PASSWORD must be set in production (individual env vars mode)');
  }
  poolConfig.password = password;
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
  // Los reintentos ante saturación del pool (EMAXCONNSESSION) necesitan más
  // vueltas que un timeout de red puntual: bajo un pico de ~11 requests, los
  // slots se liberan en ms pero hay que esperar el turno. Configurable por env.
  const { retries = parseInt(process.env.DB_QUERY_RETRIES || '4', 10), baseDelayMs = 200 } = opts;
  const retryableCodes = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPIPE',
    '53300', // too_many_connections (SQLSTATE) — pool/Supavisor lleno
    '53400', // configuration_limit_exceeded
  ]);
  const retryableMessages = [
    'timeout exceeded when trying to connect',
    'Connection terminated unexpectedly',
    'connection terminated',
    'Connection terminated',
    'server closed the connection unexpectedly',
    'Connection ended',
    // Saturación del pooler de Supavisor / Postgres en modo sesión:
    'max clients reached',
    'Max client connections reached',
    'EMAXCONNSESSION',
    'too many clients',
    'remaining connection slots',
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
        retryableMessages.some(m => err.message?.toLowerCase().includes(m.toLowerCase()));
      if (!isRetryable || attempt === retries) throw err;
      // Backoff exponencial + jitter: sin jitter, los ~11 requests que fallan
      // a la vez reintentarían sincronizados y volverían a chocar.
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
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
