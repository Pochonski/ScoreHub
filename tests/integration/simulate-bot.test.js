/**
 * tests/integration/simulate-bot.test.js — Fase 8.6 (Limitación B)
 *
 * Verifica que `scripts/simulate-bot.js` funciona correctamente:
 *   1. Crea los usuarios esperados
 *   2. Popula las tablas relacionadas
 *   3. Es idempotente (puede ejecutarse múltiples veces)
 *
 * El test ejecuta el script en dry-run y luego en modo real con
 * USERS_COUNT pequeño, y verifica los efectos en la DB.
 */

process.env.NODE_ENV = 'test';

const { spawnSync } = require('child_process');
const path = require('path');
const { pool } = require('../../database/connection');

const SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'simulate-bot.js'
);

describe('integration/simulate-bot — simulación de actividad del bot', () => {
  let connected = false;

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
      connected = true;
    } catch (err) {
      console.warn(`[simulate-bot] DB not available: ${err.message}`);
    }
  });

  afterAll(async () => {
    if (connected) {
      try { await pool.end(); } catch {}
    }
  });

  function run(args = [], env = {}) {
    return spawnSync('node', [SCRIPT_PATH, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 30000,
    });
  }

  test('dry-run no modifica la DB', async () => {
    if (!connected) return;
    const before = await pool.query('SELECT count(*) FROM usuarios WHERE alias LIKE $1', ['sim_%']);
    const beforeCount = Number(before.rows[0].count);

    const result = run([], { SIMULATE_BOT_DRY_RUN: '1' });
    expect(result.status).toBe(0);

    const after = await pool.query('SELECT count(*) FROM usuarios WHERE alias LIKE $1', ['sim_%']);
    const afterCount = Number(after.rows[0].count);
    expect(afterCount).toBe(beforeCount);
  }, 35000);

  test('ejecuta con USERS_COUNT=3 y popula tablas', async () => {
    if (!connected) return;
    const result = run(['--users=3']);
    expect(result.status).toBe(0);

    // Verificar que al menos 3 usuarios sim_* existen
    const users = await pool.query('SELECT count(*) FROM usuarios WHERE alias LIKE $1', ['sim_%']);
    expect(Number(users.rows[0].count)).toBeGreaterThanOrEqual(3);

    // Verificar que las tablas relacionadas tienen datos
    const equipos = await pool.query(
      `SELECT count(*) FROM equipos_seguidos es
       JOIN usuarios u ON es.id_usuario = u.id
       WHERE u.alias LIKE $1`,
      ['sim_%']
    );
    expect(Number(equipos.rows[0].count)).toBeGreaterThan(0);

    const historial = await pool.query(
      `SELECT count(*) FROM historial_consultas hc
       JOIN usuarios u ON hc.id_usuario = u.id
       WHERE u.alias LIKE $1`,
      ['sim_%']
    );
    expect(Number(historial.rows[0].count)).toBeGreaterThan(0);
  }, 35000);

  test('FK cascade: borrar usuario borra sus datos', async () => {
    if (!connected) return;
    // Asegurar que hay simulaciones
    await pool.query("DELETE FROM usuarios WHERE alias LIKE 'sim_%'");
    const result = run(['--users=2']);
    expect(result.status).toBe(0);

    // Obtener un userId
    const users = await pool.query(
      "SELECT id FROM usuarios WHERE alias LIKE 'sim_%' LIMIT 1"
    );
    expect(users.rows.length).toBeGreaterThan(0);
    const userId = users.rows[0].id;

    // Borrar el usuario (debe cascade-borrar equipos_seguidos, historial, apuestas)
    await pool.query('DELETE FROM usuarios WHERE id = $1', [userId]);

    const remaining = await pool.query(
      'SELECT count(*) FROM equipos_seguidos WHERE id_usuario = $1',
      [userId]
    );
    expect(Number(remaining.rows[0].count)).toBe(0);

    const remainingHist = await pool.query(
      'SELECT count(*) FROM historial_consultas WHERE id_usuario = $1',
      [userId]
    );
    expect(Number(remainingHist.rows[0].count)).toBe(0);
  }, 35000);

  test('idempotencia: ejecutar 2 veces no duplica', async () => {
    if (!connected) return;
    await pool.query("DELETE FROM usuarios WHERE alias LIKE 'sim_%'");

    const r1 = run(['--users=3']);
    expect(r1.status).toBe(0);
    const after1 = await pool.query(
      "SELECT count(*) FROM usuarios WHERE alias LIKE 'sim_%'"
    );

    const r2 = run(['--users=3']);
    expect(r2.status).toBe(0);
    const after2 = await pool.query(
      "SELECT count(*) FROM usuarios WHERE alias LIKE 'sim_%'"
    );

    // Debe haber la misma cantidad (cleanup previo + 3 nuevos)
    expect(Number(after2.rows[0].count)).toBe(Number(after1.rows[0].count));
  }, 70000);
});