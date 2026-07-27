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

const pool = {
  query: async (sql, params) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (/^(INSERT|UPDATE|DELETE)/i.test(s)) {
      writes.push({ via: 'pool', sql: s, params });
    }
    return { rows: [], rowCount: 0 };
  },
};

function recordDb(op) {
  return async (table, ...args) => {
    writes.push({ via: 'db', op, table, args });
    return { data: [], error: null };
  };
}

const db = {
  query: async () => ({ data: [], error: null }),
  insert: recordDb('insert'),
  upsert: recordDb('upsert'),
  update: recordDb('update'),
  remove: recordDb('remove'),
  execAdvanced: async (sql, params) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (/^(INSERT|UPDATE|DELETE)/i.test(s)) writes.push({ via: 'execAdvanced', sql: s, params });
    return [];
  },
  execAdvancedFull: async () => ({ rows: [], rowCount: 0 }),
};

function reset() { writes.length = 0; }
function getWrites() { return writes.map((w) => ({ ...w })); }

module.exports = { pool, db, reset, getWrites };
