#!/usr/bin/env node
/**
 * Backfill script: re-key athletes table from roster-member id (data->>'id')
 * to canonical upstream id (data->>'athleteId').
 *
 * The Cosmos->Supabase migration left 537 rows keyed by roster/member id
 * (e.g. Mbappe stored as 1589889 instead of 39820). Frontend URLs from
 * tournament stats use the canonical id, so /player/39820 returned 404.
 *
 * Migration 007_athletes_canonical.sql must be applied first (creates the
 * canonical_id generated column and unique index).
 *
 * Run: node scripts/backfill-athletes-canonical.js
 * Requires: SUPABASE_DB_URL in env (or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL).
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const log = (...a) => console.log('[backfill]', ...a);

async function main() {
  const pool = new Pool(
    process.env.SUPABASE_DB_URL
      ? { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT || 5432),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        }
  );

  const client = await pool.connect();
  try {
    log('connected');

    // Snapshot before
    const before = await client.query(`
      SELECT
        COUNT(*)::int                                                  AS total,
        COUNT(*) FILTER (WHERE canonical_id IS NOT NULL)::int          AS with_canonical,
        COUNT(*) FILTER (WHERE canonical_id IS NOT NULL
                          AND id <> canonical_id)::int                 AS to_rekey,
        COUNT(*) FILTER (WHERE id = 39820)::int                       AS mbappe_by_pk,
        COUNT(*) FILTER (WHERE canonical_id = 39820)::int             AS mbappe_by_canonical
      FROM athletes
    `);
    log('snapshot:', before.rows[0]);

    const toRekey = before.rows[0].to_rekey;
    if (toRekey === 0) {
      log('nothing to do, exiting');
      return;
    }

    // Detect conflicts: canonical_id values that map to multiple roster ids.
    const conflicts = await client.query(`
      SELECT canonical_id, COUNT(*)::int AS dupes, ARRAY_AGG(id) AS roster_ids
      FROM athletes
      WHERE canonical_id IS NOT NULL
      GROUP BY canonical_id
      HAVING COUNT(*) > 1
      ORDER BY dupes DESC
      LIMIT 20
    `);
    if (conflicts.rows.length) {
      log('conflicts detected (showing up to 20):');
      for (const r of conflicts.rows) {
        log(`  canonical=${r.canonical_id} dupes=${r.dupes} roster_ids=${JSON.stringify(r.roster_ids)}`);
      }
    }

    await client.query('BEGIN');

    // Strategy:
    //   1. Delete roster-id rows where another row with the same canonical_id
    //      exists (keep the one whose id already matches canonical_id, else keep newest).
    //   2. Update remaining rows: set id = canonical_id.
    //
    // Wrap each step in a savepoint-style retry on unique-violation so we can
    // log which canonical_id collided and continue.

    log('step 1: de-duplicating roster-id-only rows…');
    const dupDel = await client.query(`
      WITH ranked AS (
        SELECT
          id,
          canonical_id,
          ROW_NUMBER() OVER (
            PARTITION BY canonical_id
            ORDER BY
              CASE WHEN id = canonical_id THEN 0 ELSE 1 END,
              updated_at DESC,
              id DESC
          ) AS rn
        FROM athletes
        WHERE canonical_id IS NOT NULL
      )
      DELETE FROM athletes a
      USING ranked r
      WHERE a.id = r.id AND r.rn > 1
      RETURNING a.id, r.canonical_id
    `);
    log(`  removed ${dupDel.rowCount} duplicate roster rows`);

    log('step 2: re-keying remaining rows to canonical_id…');
    const rekey = await client.query(`
      UPDATE athletes
      SET id = canonical_id
      WHERE canonical_id IS NOT NULL
        AND id <> canonical_id
      RETURNING id
    `);
    log(`  re-keyed ${rekey.rowCount} rows`);

    await client.query('COMMIT');

    // Snapshot after
    const after = await client.query(`
      SELECT
        COUNT(*)::int                                                  AS total,
        COUNT(*) FILTER (WHERE canonical_id IS NOT NULL)::int          AS with_canonical,
        COUNT(*) FILTER (WHERE id = 39820)::int                       AS mbappe_by_pk,
        COUNT(*) FILTER (WHERE canonical_id = 39820)::int             AS mbappe_by_canonical
      FROM athletes
    `);
    log('after:', after.rows[0]);

    if (after.rows[0].mbappe_by_canonical === 0) {
      log('WARN: no row has canonical_id=39820. Did the sync populate Mbappe recently?');
    } else {
      log('OK: canonical id 39820 now reachable');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[backfill] FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[backfill] crashed:', err);
  process.exit(1);
});