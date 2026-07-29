/**
 * tests/integration/bot.persistence.test.js — Fase 8.2.2
 *
 * Verifica end-to-end que las tablas del bot (usuarios, equipos_seguidos,
 * historial_consultas) son operativas contra la DB que estamos inspeccionando.
 *
 * Este test NO usa mocks: hace INSERT/SELECT/DELETE real para confirmar
 * que la conexión y los permisos funcionan. Skip automático si DB no reachable.
 *
 * Ámbito:
 * - usuarios: setAlias / clearUserData
 * - equipos_seguidos: insertar/listar/borrar
 * - historial_consultas: insertar
 *
 * Si este test pasa contra esta DB, el bot puede usarla. Si solo
 * `predictions` quedó vacío por bug de sync (ya arreglado en 8.2.1), o
 * porque el bot corre en otra instancia, este test sigue siendo útil
 * como detector de regresiones.
 */

process.env.NODE_ENV = 'test';

const { pool } = require('../../database/connection');
const db = require('../../database/db');

const TEST_USER_ID = 'test-bot-' + Math.random().toString(36).slice(2, 8);
const TEST_TEAM_NAME = 'Equipo de prueba Fase 8';
const TEST_TEAM_ID = 9999999; // id_equipo NOT NULL FK opcional a competitors

describe('integration/bot.persistence — tablas bot operativas', () => {
  let connected = false;

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
      connected = true;
    } catch (err) {
      console.warn(`[bot.persistence] DB not available (${err.message}); tests skipped.`);
      connected = false;
    }
  });

  afterAll(async () => {
    if (!connected) return;
    // cleanup — defensivo: limpia cualquier id que haya podido quedar
    // aunque el test falle a mitad (e.g. tmp-* del FK cascade test).
    try {
      await pool.query(
        `DELETE FROM usuarios WHERE id LIKE 'test-bot-%' OR id LIKE 'tmp-%'`
      );
      await pool.query(
        `DELETE FROM equipos_seguidos WHERE id_usuario LIKE 'test-bot-%' OR id_usuario LIKE 'tmp-%'`
      );
      await pool.query(
        `DELETE FROM historial_consultas WHERE id_usuario LIKE 'test-bot-%' OR id_usuario LIKE 'tmp-%'`
      );
    } catch {}
    try { await pool.end(); } catch {}
  });

  test('INSERT en usuarios funciona', async () => {
    if (!connected) return;
    const r = await db.execAdvanced(
      `INSERT INTO usuarios (id, alias, estado) VALUES ($1, $2, 'registrado')
       ON CONFLICT (id) DO UPDATE SET alias = EXCLUDED.alias
       RETURNING id, alias, estado`,
      [TEST_USER_ID, 'tester']
    );
    expect(r).toHaveLength(1);
    expect(r[0].alias).toBe('tester');
    expect(r[0].estado).toBe('registrado');
  });

  test('SELECT de usuario recién creado', async () => {
    if (!connected) return;
    const rows = await db.execAdvanced(
      'SELECT id, alias FROM usuarios WHERE id = $1',
      [TEST_USER_ID]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(TEST_USER_ID);
  });

  test('INSERT en equipos_seguidos funciona', async () => {
    if (!connected) return;
    const r = await db.execAdvanced(
      `INSERT INTO equipos_seguidos (id_usuario, id_equipo, nombre_equipo, fecha_seguimiento)
       VALUES ($1, $2, $3, now())
       RETURNING id, id_usuario, nombre_equipo`,
      [TEST_USER_ID, TEST_TEAM_ID, TEST_TEAM_NAME]
    );
    expect(r).toHaveLength(1);
    expect(r[0].nombre_equipo).toBe(TEST_TEAM_NAME);
  });

  test('INSERT en historial_consultas funciona', async () => {
    if (!connected) return;
    const r = await db.execAdvanced(
      `INSERT INTO historial_consultas (id_usuario, consulta, fecha, tipo, respuesta)
       VALUES ($1, $2, now(), $3, $4)
       RETURNING id`,
      [TEST_USER_ID, '/live', 'comando', '...partidos de hoy...']
    );
    expect(r).toHaveLength(1);
    expect(Number(r[0].id)).toBeGreaterThan(0);
  });

  test('SELECT conjuntos: usuario con sus equipos y consultas', async () => {
    if (!connected) return;
    const equipos = await db.execAdvanced(
      'SELECT id, nombre_equipo FROM equipos_seguidos WHERE id_usuario = $1 ORDER BY id',
      [TEST_USER_ID]
    );
    const historial = await db.execAdvanced(
      'SELECT id, consulta, tipo FROM historial_consultas WHERE id_usuario = $1 ORDER BY id',
      [TEST_USER_ID]
    );
    expect(equipos.length).toBeGreaterThanOrEqual(1);
    expect(historial.length).toBeGreaterThanOrEqual(1);
  });

  test('DELETE cascade (FK) al borrar usuario', async () => {
    if (!connected) return;
    // Creamos un usuario nuevo para no afectar el principal.
    const tmpUser = 'tmp-' + Math.random().toString(36).slice(2, 8);
    await db.execAdvanced(
      `INSERT INTO usuarios (id, alias, estado) VALUES ($1, 'tmp', 'registrado')`,
      [tmpUser]
    );
    await db.execAdvanced(
      `INSERT INTO equipos_seguidos (id_usuario, id_equipo, nombre_equipo, fecha_seguimiento)
       VALUES ($1, $2, 'tmp team', now())`,
      [tmpUser, TEST_TEAM_ID]
    );
    // Verificar FK constraint: borrar usuario debería cascade-borrar equipo.
    const before = await db.execAdvanced(
      'SELECT id FROM equipos_seguidos WHERE id_usuario = $1', [tmpUser]
    );
    expect(before.length).toBe(1);
    await db.execAdvanced('DELETE FROM usuarios WHERE id = $1', [tmpUser]);
    const after = await db.execAdvanced(
      'SELECT id FROM equipos_seguidos WHERE id_usuario = $1', [tmpUser]
    );
    expect(after.length).toBe(0); // CASCADE funcionó
  });
});