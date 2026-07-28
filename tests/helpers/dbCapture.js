/**
 * Captura de escrituras a la base para los golden-master de sync (Fase 7).
 *
 * Todos los writes de `syncService` pasan por `pool.query` (vía `upsertMany` y
 * los helpers UNNEST) o por el wrapper `db.*`/`execAdvanced`. Este helper mockea
 * ambos caminos, registra cada mutación (INSERT/UPDATE/DELETE) con su SQL
 * normalizado + params, y devuelve `{ rows: [] }` a las lecturas.
 *
 * NOTA: la captura es a nivel SQL (fiel al comportamiento actual). En la Fase 4
 * (refactor de sync a repos) el mecanismo de escritura cambia y estos snapshots
 * se actualizan deliberadamente; hasta entonces son un tripwire estable.
 */

const writes = [];

function recordSql(via, sql, params) {
  const s = String(sql).replace(/\s+/g, ' ').trim();
  if (/^(INSERT|UPDATE|DELETE)/i.test(s)) writes.push({ via, sql: s, params });
}

const pool = {
  query: async (sql, params) => {
    recordSql('pool', sql, params);
    return { rows: [], rowCount: 0 };
  },
  // Para withTransaction: un client que captura writes (BEGIN/COMMIT se ignoran).
  connect: async () => ({
    query: async (sql, params) => {
      recordSql('tx', sql, params);
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  }),
};

// Réplica del withTransaction real (database/connection.js) contra el pool mock.
async function withTransaction(fn) {
  const client = await pool.connect();
  await client.query('BEGIN');
  const r = await fn(client);
  await client.query('COMMIT');
  client.release();
  return r;
}

function recordDb(op) {
  return async (table, ...args) => {
    writes.push({ via: 'db', op, table, args });
    return { data: [], error: null };
  };
}

// Resultado que devuelven las lecturas por db.execAdvanced (SELECT). Los jobs
// per-game leen ids de games así; setExecResult() lo configura por test.
// Algunos jobs (syncAthletes) hacen varias lecturas distintas → setExecResults
// permite una secuencia (una por llamada; se agota a []).
let execResult = [];
let execQueue = null;
function setExecResult(r) { execResult = r; execQueue = null; }
function setExecResults(seq) { execQueue = [...seq]; }

const db = {
  query: async () => ({ data: [], error: null }),
  insert: recordDb('insert'),
  upsert: recordDb('upsert'),
  update: recordDb('update'),
  remove: recordDb('remove'),
  execAdvanced: async (sql, params) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (/^(INSERT|UPDATE|DELETE)/i.test(s)) {
      writes.push({ via: 'execAdvanced', sql: s, params });
      return []; // db.execAdvanced real devuelve result.rows (array)
    }
    if (execQueue) return execQueue.length ? execQueue.shift() : [];
    return execResult;
  },
  execAdvancedFull: async () => ({ rows: execResult, rowCount: execResult.length }),
};

function reset() { writes.length = 0; execResult = []; execQueue = null; }
function getWrites() { return writes.map((w) => ({ ...w })); }

module.exports = { pool, db, withTransaction, reset, getWrites, setExecResult, setExecResults };
