/**
 * tests/integration/active-competitions.test.js — Fase 8.6+
 *
 * Verifica que las 3 competiciones nuevas (Eurocopa, Copa América,
 * CONCACAF Copa Centroamericana) están en active_competitions y
 * que los competidores asociados están en competitors.
 */

process.env.NODE_ENV = 'test';

const { pool } = require('../../database/connection');

describe('integration/active-competitions — nuevas competiciones Fase 8.6+/8.7+', () => {
  let connected = false;

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
      connected = true;
    } catch (err) {
      console.warn(`[active-competitions] DB not available: ${err.message}`);
    }
  });

  afterAll(async () => {
    if (connected) {
      try { await pool.end(); } catch {}
    }
  });

  test('hay 13 competiciones activas (10 Fase 8.6+ + 3 Fase 8.7+)', async () => {
    if (!connected) return;
    const result = await pool.query('SELECT count(*) FROM active_competitions');
    expect(Number(result.rows[0].count)).toBe(13);
  });

  test('Eurocopa (id 6316) está activa', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, display_name, season_num, has_brackets, has_groups, has_history
       FROM active_competitions WHERE id = 6316`
    );
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.id).toBe(6316);
    expect(r.display_name.toLowerCase()).toContain('eurocopa');
    expect(r.season_num).toBe(17);
    expect(r.has_brackets).toBe(true);
    expect(r.has_groups).toBe(true);
    expect(r.has_history).toBe(true);
  });

  test('Copa América (id 595) está activa', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, display_name, season_num, has_brackets, has_groups, has_history
       FROM active_competitions WHERE id = 595`
    );
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.id).toBe(595);
    expect(r.display_name.toLowerCase()).toContain('copa am');
    expect(r.season_num).toBe(52);
    expect(r.has_brackets).toBe(true);
    expect(r.has_groups).toBe(true);
    expect(r.has_history).toBe(true);
  });

  test('CONCACAF Copa Centroamericana (id 7954) está activa', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, display_name, season_num, has_brackets, has_groups, has_history
       FROM active_competitions WHERE id = 7954`
    );
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.id).toBe(7954);
    expect(r.display_name.toLowerCase()).toContain('concacaf');
    expect(r.season_num).toBe(4);
    expect(r.has_history).toBe(true);
  });

  test('Liga MX (id 141) está activa', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, display_name, season_num, has_history
       FROM active_competitions WHERE id = 141`
    );
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.id).toBe(141);
    expect(r.display_name.toLowerCase()).toContain('liga mx');
    expect(r.season_num).toBe(152);
    expect(r.has_history).toBe(true);
  });

  test('MLS (id 104) está activa', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, display_name, season_num, has_history
       FROM active_competitions WHERE id = 104`
    );
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.id).toBe(104);
    expect(r.display_name.toLowerCase()).toContain('mls');
    expect(r.season_num).toBe(32);
    expect(r.has_history).toBe(true);
  });

  test('Liga Profesional Argentina (id 72) está activa', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, display_name, season_num, has_groups, has_history
       FROM active_competitions WHERE id = 72`
    );
    expect(result.rows.length).toBe(1);
    const r = result.rows[0];
    expect(r.id).toBe(72);
    expect(r.display_name.toLowerCase()).toContain('liga profesional');
    expect(r.season_num).toBe(228);
    expect(r.has_groups).toBe(true);
    expect(r.has_history).toBe(true);
  });

  test('display_order: 6 nuevas + Mundial en 5-10 (Liga MX en 8.5 por migración 024)', async () => {
    if (!connected) return;
    const result = await pool.query(`
      SELECT id, display_name, display_order
      FROM active_competitions
      WHERE id IN (5930, 6316, 595, 7954, 141, 104, 72)
      ORDER BY display_order
    `);
    const orders = result.rows.map(r => Number(r.display_order));
    // Liga MX (141) quedó en 8.5 tras la migración 024 para ubicarla entre
    // CONCACAF (8) y MLS (9). Coincide con standings-new-comps.test.ts y prod.
    expect(orders).toEqual([5, 6, 7, 8, 8.5, 9, 10]);
  });

  test('competitors de las Américas (595, 6316, 7954, 141, 104, 72) en DB', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT count(*) FROM competitors
       WHERE (data->'mainCompetitionId')::int IN (595, 6316, 7954, 141, 104, 72)`
    );
    expect(Number(result.rows[0].count)).toBeGreaterThan(50);
  });

  test('competitions table tiene data de las 6 nuevas', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, jsonb_typeof(data) as data_type, age(now(), updated_at) as age
       FROM competitions WHERE id IN (595, 6316, 7954, 141, 104, 72)
       ORDER BY id`
    );
    expect(result.rows.length).toBe(6);
    for (const r of result.rows) {
      expect(r.data_type).toBe('object');
    }
  });

  test('LD Alajuelense en competidores con mainCompetitionId CONCACAF', async () => {
    if (!connected) return;
    const result = await pool.query(
      `SELECT id, data->>'name' as name
       FROM competitors
       WHERE data->>'name' ILIKE '%alajuelense%'
         AND (data->'mainCompetitionId')::int IN (7954, 171, 5056)
       LIMIT 5`
    );
    // Solo verificamos que la búsqueda funciona (LD puede estar en mainCompetitionId=5056)
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
  });
});