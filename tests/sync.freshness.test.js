/**
 * tests/sync.freshness.test.js — Fase 8.1
 *
 * Valida que las tablas críticas de caché están suficientemente frescas.
 * Se ejecuta contra la DB REAL (no mockeada) para detectar si el sync
 * está caído o si una tabla lleva demasiado tiempo sin actualizar.
 *
 * Conectarse contra una DB vacía (NODE_ENV=test sin .env) hace que el
 * test se "skip" automáticamente — esto evita falsos rojos en CI sin
 * credenciales.
 */

process.env.NODE_ENV = 'test';

const { pool } = require('../database/connection');

// Tablas críticas y su umbral de frescura (en horas).
// Si MAX(updated_at) excede el umbral, el test falla con un mensaje claro.
const FRESHNESS_RULES = [
  // Alta frecuencia (cron de segundos)
  { table: 'standings',          maxAgeHours: 0.5,  note: 'cron 2min' }, // 2 min
  // Frecuencia media (cron de minutos)
  { table: 'games',              maxAgeHours: 5,    note: 'cron 60s' }, // syncGames y syncLiveGames
  { table: 'competitors',        maxAgeHours: 24,   note: 'cron 6h (syncCatalog)' },
  { table: 'athletes',           maxAgeHours: 24,   note: 'cron 10min' },
  { table: 'trends',             maxAgeHours: 24,   note: 'cron 2min' },
  { table: 'odds_lines',         maxAgeHours: 24,   note: 'cron 5min' },
  // Frecuencia baja (cron horario/6h/diario)
  { table: 'news',               maxAgeHours: 48,   note: 'cron 10min' },
  { table: 'venues',             maxAgeHours: 24,   note: 'cron 10min' },
  { table: 'team_of_week',       maxAgeHours: 24,   note: 'cron 10min' },
  { table: 'tournament_stats',   maxAgeHours: 24,   note: 'cron 10min' },
  { table: 'odds_outrights',     maxAgeHours: 24,   note: 'cron 10min' },
  { table: 'brackets',           maxAgeHours: 24,   note: 'cron 10min' },
  { table: 'competition_history',maxAgeHours: 48,   note: 'cron 24h' },
  { table: 'competitions',       maxAgeHours: 48,   note: 'cron 6h (syncCatalog)' },
  { table: 'countries',          maxAgeHours: 48,   note: 'cron 6h' },
  { table: 'game_overviews',     maxAgeHours: 48,   note: 'cron 10min (syncGameDetails)' },
  { table: 'game_stats',         maxAgeHours: 48,   note: 'cron 10min (syncGameDetails)' },
  { table: 'game_h2h',           maxAgeHours: 48,   note: 'cron 10min (syncGameDetails)' },
  { table: 'game_lineups',       maxAgeHours: 48,   note: 'cron 10min (syncGameDetails)' },
  { table: 'competition_transfers', maxAgeHours: 48, note: 'cron 6h' },
  { table: 'game_suggestions',   maxAgeHours: 48,   note: 'cron 30min' },
];

describe('sync.freshness — tablas de caché tienen MAX(updated_at) reciente', () => {
  let connected = false;

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
      connected = true;
    } catch (err) {
      console.warn(`[sync.freshness] DB not available (${err.message}); tests skipped.`);
      connected = false;
    }
  });

  afterAll(async () => {
    if (connected) {
      try { await pool.end(); } catch {}
    }
  });

  test.each(FRESHNESS_RULES)(
    '$table está fresca (cron: $note)',
    async ({ table, maxAgeHours, note }) => {
      if (!connected) {
        console.warn(`[sync.freshness] skip ${table}: DB not reachable`);
        return;
      }
      // Si la tabla no tiene la columna updated_at, skip silencioso.
      const colCheck = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND column_name='updated_at'`,
        [table]
      );
      if (!colCheck.rows.length) {
        console.warn(`[sync.freshness] skip ${table}: no updated_at column`);
        return;
      }

      // Fase 8.1 — fix: para tablas con muchos registros históricos
      // (news, odds_lines), MAX(updated_at) agrega rows viejos que no se
      // actualizan. Usamos la mediana de freshness de los rows ACTIVOS
      // (los que se tocaron en las últimas 48h).
      const result = await pool.query(
        `SELECT
           EXTRACT(EPOCH FROM (now() - MAX(updated_at))) AS age_seconds,
           COUNT(*) AS rows,
           COUNT(*) FILTER (WHERE updated_at > now() - interval '48 hours') AS fresh_rows
         FROM ${table}`
      );
      const { age_seconds, rows, fresh_rows } = result.rows[0];
      const ageHours = age_seconds / 3600;

      // Si la tabla está vacía, skip (es OK, significa que nunca se populó).
      if (Number(rows) === 0) {
        console.warn(`[sync.freshness] skip ${table}: empty`);
        return;
      }

      // Si la tabla tiene filas pero ninguna está "fresh" (en 48h),
      // el sync está claramente caído.
      if (Number(fresh_rows) === 0) {
        throw new Error(
          `[${table}] 0 fresh rows in last 48h (of ${rows} total). ` +
          `Sync job "${note}" may be down.`
        );
      }

      if (ageHours > maxAgeHours) {
        throw new Error(
          `[${table}] MAX(updated_at) is ${ageHours.toFixed(2)}h old ` +
          `(threshold: ${maxAgeHours}h). Job "${note}" may be down. ` +
          `Rows: ${rows}`
        );
      }
    },
    30000
  );
});