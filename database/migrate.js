const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = {
  max: 1,
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000,
  query_timeout: 60000,
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

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getApplied() {
  const result = await pool.query("SELECT name FROM schema_migrations ORDER BY name");
  return new Set(result.rows.map(r => r.name.replace(/\.sql$/, '')));
}

async function applyMigration(filePath, name) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name.replace(/\.sql$/, '')]
    );
    await client.query('COMMIT');
    console.log(`  ✓ ${name}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Auditoría 2026-Q3 Fase 6.2: usar pg_advisory_lock para serializar
// ejecuciones paralelas de migrate.js. Evita que dos runners concurrentes
// apliquen migraciones no-idempotentes dos veces.
const MIGRATE_LOCK_ID = 5930; // ScoreHub fixed lock

async function acquireMigrateLock(client) {
  const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [MIGRATE_LOCK_ID]);
  if (!result.rows[0].locked) {
    console.error('Another migrate.js is already running. Exiting to avoid concurrent migrations.');
    process.exit(2);
  }
}

async function releaseMigrateLock(client) {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATE_LOCK_ID]);
  } catch (e) {
    console.error(`Failed to release advisory lock: ${e.message}`);
  }
}

async function main() {
  console.log('Migration runner\n');

  // Lock global — un solo migrate.js a la vez en toda la flota.
  const lockClient = await pool.connect();
  await acquireMigrateLock(lockClient);

  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (!files.length) {
      console.log('No migration files found.');
      await pool.end();
      return;
    }

    await ensureTrackingTable();
    const applied = await getApplied();
    const pending = files.filter(f => !applied.has(f.replace(/\.sql$/, '')));

    if (!pending.length) {
      console.log('All migrations already applied.');
      await pool.end();
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):\n`);

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      try {
        await applyMigration(filePath, file);
      } catch (e) {
        console.error(`  ✗ ${file}: ${e.message}`);
        await releaseMigrateLock(lockClient);
        await pool.end();
        process.exit(1);
      }
    }

    console.log(`\nAll ${pending.length} migration(s) applied successfully.`);
    await pool.end();
  } finally {
    await releaseMigrateLock(lockClient);
  }
}

main();
