/**
 * database/db.js
 *
 * Wraps the two DB access strategies available to ScoreHub:
 *
 *  - supabase (PostgREST over HTTP, persistent connection-less)
 *      Used for simple queries: single-table selects, inserts, upserts, updates,
 *      deletes. No persistent connections — ideal for serverless functions
 *      on Vercel.
 *
 *  - execAdvanced (pg pool, max=1 connection)
 *      Used for queries that PostgREST cannot express: CTEs, multi-row
 *      INSERTs, complex JOINs, RETURNING-clause manipulation. Pool is
 *      intentionally limited to one connection per process because most
 *      traffic is already going through the HTTP path.
 *
 * Rule of thumb:
 *   db.query/insert/upsert/update/remove → Supabase HTTP
 *   db.execAdvanced                        → pg
 *
 * See docs/refactor-plans/04-supabase-js-migration.md for the full rationale.
 */

const { getClient, isEnabled } = require('./supabaseClient');
const { pool, pgQueryRetry } = require('./connection');
const logger = require('../utils/logger');
const { recordSupabaseCall, recordSupabaseError, recordPgCall, recordPgError } = require('../utils/dbStats');

// ============================================================================
// Supabase HTTP path
// ============================================================================

/**
 * Generic SELECT helper that maps to PostgREST.
 *
 * options: {
 *   select:    string  // comma-separated columns, defaults to '*'
 *   eq:        object  // col => value filters with =  (multiple)
 *   in:        object  // col => [values] filters with = ANY
 *   order:     string | [{column, asc}]
 *   limit:     number
 *   range:     [from, to]
 *   single:    boolean // expects exactly 1 row
 *   maybeSingle: boolean // expects 0 or 1 row (avoids 406 error if missing)
 * }
 *
 * Returns: { data, error } matching the @supabase/supabase-js shape.
 * Callers should: if (error) throw error; const row = data;
 */
async function query(table, options = {}) {
  if (!isEnabled()) {
    // Fall back to pg for callers that don't even know about Supabase.
    return queryViaPg(table, options);
  }
  try {
    recordSupabaseCall();
    let q = getClient().from(table).select(options.select || '*');
    if (options.eq) {
      for (const [col, val] of Object.entries(options.eq)) {
        q = q.eq(col, val);
      }
    }
    if (options.in) {
      for (const [col, vals] of Object.entries(options.in)) {
        q = q.in(col, vals);
      }
    }
    if (options.order) {
      if (Array.isArray(options.order)) {
        for (const o of options.order) {
          q = q.order(o.column, { ascending: o.asc });
        }
      } else {
        q = q.order(options.order.column, { ascending: options.order.asc });
      }
    }
    if (options.limit) q = q.limit(options.limit);
    if (options.range) q = q.range(options.range[0], options.range[1]);
    if (options.single) q = q.single();
    else if (options.maybeSingle) q = q.maybeSingle();

    const { data, error } = await q;
    if (error) recordSupabaseError();
    return { data, error };
  } catch (err) {
    recordSupabaseError();
    logger.error({ err: err.message, table }, 'db.query HTTP failed');
    throw err;
  }
}

/**
 * INSERT rows into a table. Returns { data, error }.
 */
async function insert(table, rows, { onConflict = null, select = null } = {}) {
  if (!isEnabled()) return insertViaPg(table, rows, { onConflict, select });
  try {
    recordSupabaseCall();
    let q = getClient().from(table).insert(rows);
    if (onConflict) q = q.onConflict(onConflict);
    if (select) q = q.select(select);
    const { data, error } = await q;
    if (error) recordSupabaseError();
    return { data, error };
  } catch (err) {
    recordSupabaseError();
    logger.error({ err: err.message, table }, 'db.insert HTTP failed');
    throw err;
  }
}

/**
 * UPSERT rows. `onConflict` (string or array) is REQUIRED for upserts.
 * Returns { data, error }.
 */
async function upsert(table, rows, onConflict, { select = null } = {}) {
  if (!isEnabled()) return upsertViaPg(table, rows, onConflict, { select });
  try {
    recordSupabaseCall();
    let q = getClient().from(table).upsert(rows, { onConflict });
    if (select) q = q.select(select);
    const { data, error } = await q;
    if (error) recordSupabaseError();
    return { data, error };
  } catch (err) {
    recordSupabaseError();
    logger.error({ err: err.message, table }, 'db.upsert HTTP failed');
    throw err;
  }
}

/**
 * UPDATE rows filtered by `filter.eq` / `filter.in`. Returns { data, error }.
 */
async function update(table, updates, filter) {
  if (!isEnabled()) return updateViaPg(table, updates, filter);
  try {
    recordSupabaseCall();
    let q = getClient().from(table).update(updates);
    if (filter.eq) {
      for (const [col, val] of Object.entries(filter.eq)) {
        q = q.eq(col, val);
      }
    }
    if (filter.in) {
      for (const [col, vals] of Object.entries(filter.in)) {
        q = q.in(col, vals);
      }
    }
    const { data, error } = await q.select();
    if (error) recordSupabaseError();
    return { data, error };
  } catch (err) {
    recordSupabaseError();
    logger.error({ err: err.message, table }, 'db.update HTTP failed');
    throw err;
  }
}

/**
 * DELETE rows filtered by `filter`. Returns { data, error }.
 */
async function remove(table, filter) {
  if (!isEnabled()) return removeViaPg(table, filter);
  try {
    recordSupabaseCall();
    let q = getClient().from(table).delete();
    if (filter.eq) {
      for (const [col, val] of Object.entries(filter.eq)) {
        q = q.eq(col, val);
      }
    }
    if (filter.in) {
      for (const [col, vals] of Object.entries(filter.in)) {
        q = q.in(col, vals);
      }
    }
    const { data, error } = await q.select();
    if (error) recordSupabaseError();
    return { data, error };
  } catch (err) {
    recordSupabaseError();
    logger.error({ err: err.message, table }, 'db.remove HTTP failed');
    throw err;
  }
}

// ============================================================================
// pg-only path (advanced SQL)
// ============================================================================

/**
 * Run a raw SQL statement via the (now size-1) pg pool.
 * Reserved for queries PostgREST can't do (CTEs, multi-row INSERTs, etc).
 *
 * Uses `pgQueryRetry` from connection.js to absorb transient connection
 * failures (timeout, ECONNRESET) before propagating. The retry only fires
 * on errors tagged as network/connection — constraint violations surface
 * immediately.
 */
async function execAdvanced(sql, params = []) {
  try {
    recordPgCall();
    const result = await pgQueryRetry(sql, params);
    return result.rows;
  } catch (err) {
    recordPgError();
    logger.error({ err: err.message }, 'db.execAdvanced failed');
    throw err;
  }
}

/**
 * Same as execAdvanced but returns the full result (rows, rowCount).
 * Useful for tests and debugging. Avoid in hot paths.
 */
async function execAdvancedFull(sql, params = []) {
  try {
    recordPgCall();
    const result = await pgQueryRetry(sql, params);
    return result;
  } catch (err) {
    recordPgError();
    throw err;
  }
}

// ============================================================================
// Fallbacks (when Supabase not configured)
// ============================================================================

function buildWhereFromFilters(filters = {}) {
  const conds = [];
  const params = [];
  if (filters.eq) {
    for (const [col, val] of Object.entries(filters.eq)) {
      params.push(val);
      conds.push(`${col} = $${params.length}`);
    }
  }
  if (filters.in) {
    for (const [col, vals] of Object.entries(filters.in)) {
      params.push(vals);
      conds.push(`${col} = ANY($${params.length}::int[])`);
    }
  }
  return { conds, params };
}

async function queryViaPg(table, options) {
  recordPgCall();
  try {
    const { conds, params } = buildWhereFromFilters({ eq: options.eq, in: options.in });
    let sql = `SELECT ${options.select || '*'} FROM ${table}`;
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    if (options.order) {
      const orders = Array.isArray(options.order) ? options.order : [options.order];
      sql += ' ORDER BY ' + orders.map((o) => `${o.column} ${o.asc ? 'ASC' : 'DESC'}`).join(', ');
    }
    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit, 10)}`;
    }
    if (options.range) {
      const [from, to] = options.range;
      sql += ` OFFSET ${parseInt(from, 10)}`;
      params.push(options.limit || to - from + 1);
      sql += ` LIMIT $${params.length}`;
    }
    const result = await pgQueryRetry(sql, params);
    const rows = result.rows;
    if (options.single && rows.length === 0) {
      return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    if (options.single || options.maybeSingle) {
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null };
  } catch (err) {
    recordPgError();
    logger.error({ err: err.message, table }, 'db.query pg fallback failed');
    throw err;
  }
}

async function insertViaPg(table, rows, { onConflict, select }) {
  recordPgCall();
  try {
    const arr = Array.isArray(rows) ? rows : [rows];
    if (!arr.length) return { data: [], error: null };
    const keys = Object.keys(arr[0]);
    const values = arr.flatMap((r) => keys.map((k) => r[k]));
    const placeholders = arr.map((_, ri) =>
      '(' + keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ') + ')'
    ).join(', ');
    let sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders}`;
    if (onConflict) {
      sql += ` ON CONFLICT (${Array.isArray(onConflict) ? onConflict.join(', ') : onConflict}) DO NOTHING`;
    }
    if (select) sql += ` RETURNING ${select}`;
    const result = await pgQueryRetry(sql, values);
    return { data: result.rows, error: null };
  } catch (err) {
    recordPgError();
    throw err;
  }
}

async function upsertViaPg(table, rows, onConflict, { select } = {}) {
  recordPgCall();
  try {
    const arr = Array.isArray(rows) ? rows : [rows];
    if (!arr.length) return { data: [], error: null };
    const keys = Object.keys(arr[0]);
    const values = arr.flatMap((r) => keys.map((k) => r[k]));
    const placeholders = arr.map((_, ri) =>
      '(' + keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ') + ')'
    ).join(', ');
    const conflictClause = Array.isArray(onConflict) ? onConflict.join(', ') : onConflict;
    const updates = keys
      .filter((k) => !conflictClause.includes(k))
      .map((k) => `${k} = EXCLUDED.${k}`)
      .join(', ');
    let sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders}
               ON CONFLICT (${conflictClause}) DO UPDATE SET ${updates}`;
    if (select) sql += ` RETURNING ${select}`;
    const result = await pgQueryRetry(sql, values);
    return { data: result.rows, error: null };
  } catch (err) {
    recordPgError();
    throw err;
  }
}

async function updateViaPg(table, updates, filter) {
  recordPgCall();
  try {
    const keys = Object.keys(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const params = keys.map((k) => updates[k]);
    const whereFromFilters = buildWhereFromFilters(filter);
    let sql = `UPDATE ${table} SET ${setClause}`;
    if (whereFromFilters.conds.length) {
      params.push(...whereFromFilters.params);
      sql += ' WHERE ' + whereFromFilters.conds
        .map((c, i) => c.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n, 10) + keys.length}`))
        .join(' AND ');
    }
    const result = await pgQueryRetry(sql, params);
    return { data: result.rows, error: null };
  } catch (err) {
    recordPgError();
    throw err;
  }
}

async function removeViaPg(table, filter) {
  recordPgCall();
  try {
    const whereFromFilters = buildWhereFromFilters(filter);
    let sql = `DELETE FROM ${table}`;
    if (whereFromFilters.conds.length) {
      sql += ' WHERE ' + whereFromFilters.conds.join(' AND ');
    }
    const result = await pgQueryRetry(sql, whereFromFilters.params);
    return { data: result.rows, error: null };
  } catch (err) {
    recordPgError();
    throw err;
  }
}

module.exports = {
  query,
  insert,
  upsert,
  update,
  remove,
  execAdvanced,
  execAdvancedFull,
  readThrough,
};

/**
 * Read-through cache pattern (Fase 8.4):
 *
 *  1. Lee de DB usando los `queryOpts` (mismo shape que `db.query`).
 *  2. Si encuentra datos → los devuelve con `source: 'db'`.
 *  3. Si NO encuentra (cache miss) → llama a `fetcher()`.
 *  4. Si `fetcher` devuelve datos → los persiste en DB con `upsert`.
 *  5. Devuelve los datos con `source: '365+writeback'`.
 *
 * Si la fila de DB está stale (edad > `ttlMs`), también se considera
 * cache miss para forzar refresh.
 *
 * @param {string} table
 * @param {object} queryOpts - mismo shape que db.query (eq, select, single, etc.)
 * @param {() => any} fetcher - función que trae datos de 365scores.
 *                             Puede devolver cualquier shape; se persiste como JSONB.
 * @param {object} [opts]
 * @param {string|string[]} [opts.onConflict='id'] - columnas de conflict para upsert.
 * @param {number} [opts.ttlMs] - si la fila de DB es más vieja que esto, se rehidrata.
 * @returns {Promise<{ data, error, source: 'db'|'365+writeback'|'365-error' }>}
 */
async function readThrough(table, queryOpts, fetcher, opts = {}) {
  const { onConflict = 'id', ttlMs = null } = opts;

  // Fase 8.6: incrementar readThroughCalls en cada llamada (no solo write-back).
  // Así el health endpoint muestra cuántas veces se invocó el patrón cache.
  try {
    require('../utils/dbStats').recordReadThroughHit();
  } catch {}

  // 1. Intentar DB
  const { data: row, error } = await query(table, queryOpts);
  if (error) return { data: null, error, source: 'db-error' };

  const hasData = row && (Array.isArray(row) ? row.length > 0 : true);
  if (hasData) {
    const single = Array.isArray(row) ? row[0] : row;
    const updatedAt = single?.updated_at;
    const isStale =
      ttlMs != null &&
      updatedAt != null &&
      Date.now() - new Date(updatedAt).getTime() > ttlMs;
    if (!isStale) {
      return { data: row, error: null, source: 'db' };
    }
  }

  // 2. Cache miss / stale: fetcher
  let fresh = null;
  let upstreamError = null;
  try {
    fresh = await fetcher();
  } catch (err) {
    upstreamError = err;
  }

  if (fresh != null && !upstreamError) {
    try {
      const rows = Array.isArray(fresh) ? fresh : [fresh];
      await upsert(table, rows.map(r => {
        if (typeof r === 'object' && r !== null && !Array.isArray(r)) return r;
        return { data: r };
      }), onConflict);
      try {
        require('../utils/dbStats').recordUpsertFromCacheMiss();
      } catch {}
    } catch (persistErr) {
      const logger = require('../utils/logger');
      logger.warn({ err: persistErr.message, table }, 'readThrough write-back failed');
    }
    return { data: fresh, error: null, source: '365+writeback' };
  }

  if (hasData) {
    return { data: row, error: null, source: 'db-stale' };
  }
  return {
    data: null,
    error: upstreamError || { message: 'no data from DB or upstream' },
    source: '365-error',
  };
}
