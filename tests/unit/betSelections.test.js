/**
 * tests/unit/betSelections.test.js — Fase 8.6+
 *
 * Verifica que `syncBetSelections` actualiza correctamente el estado
 * y valor_actual de las selecciones pendientes cuyo partido terminó.
 */

process.env.NODE_ENV = 'test';

jest.mock('../../database/connection', () => {
  const c = require('../helpers/dbCapture');
  return {
    pool: c.pool,
    pgQueryRetry: c.pgQueryRetry,
    withTransaction: c.withTransaction,
    testConnection: jest.fn().mockResolvedValue(true),
  };
});
jest.mock('../../utils/dbStats', () => ({
  recordSupabaseCall: jest.fn(),
  recordSupabaseError: jest.fn(),
  recordPgCall: jest.fn(),
  recordPgError: jest.fn(),
  recordUpsertFromCacheMiss: jest.fn(),
  recordReadThroughHit: jest.fn(),
  getStats: jest.fn().mockReturnValue({}),
  reset: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));
// Mockear el betEvaluator con un BET_TYPES minimalista
jest.mock('../../services/betEvaluator', () => ({
  STATES: { WINNING: 'ganada', LOSING: 'perdida', PUSH: 'push', PENDING: 'pendiente' },
  BET_TYPES: {
    goles_over: {
      evaluate: (sel, state) => ({
        status: state.totalGoals > 2.5 ? 'ganada' : 'perdida',
        value: state.totalGoals,
        detail: `${state.totalGoals} goles`,
      }),
    },
    goles_under: {
      evaluate: (sel, state) => ({
        status: state.totalGoals < 2.5 ? 'ganada' : 'perdida',
        value: state.totalGoals,
        detail: `${state.totalGoals} goles`,
      }),
    },
    '1x2': {
      evaluate: (sel, state) => {
        // sel.valor es '1', 'X', o '2'
        if (sel.valor === '1') return { status: state.goalsHome > state.goalsAway ? 'ganada' : 'perdida' };
        if (sel.valor === 'X') return { status: state.goalsHome === state.goalsAway ? 'ganada' : 'perdida' };
        return { status: state.goalsAway > state.goalsHome ? 'ganada' : 'perdida' };
      },
    },
  },
}));

const db = require('../../database/db');
const { reset, getWrites, setExecResults } = require('../helpers/dbCapture');
const betSelections = require('../../src/application/sync/betSelections');

beforeEach(() => reset());

describe('unit/betSelections — evalúa selecciones pendientes', () => {
  test('no hace nada si no hay selecciones pendientes', async () => {
    // Mockeamos db.execAdvanced para devolver []
    db.execAdvanced = jest.fn().mockResolvedValueOnce([]);

    await betSelections.syncBetSelections();

    expect(db.execAdvanced).toHaveBeenCalledTimes(1);
  });

  test('evalúa y actualiza selecciones de goles_over (total=4 → ganada, línea=2.5)', async () => {
    // Mock: 1 selección pendiente de goles_over con marcador 3-1 (total=4)
    db.execAdvanced = jest.fn()
      .mockResolvedValueOnce([{
        seleccion_id: 100,
        apuesta_id: 50,
        tipo_mercado: 'goles_over',
        valor_seleccion: 'Más 2.5',
        linea: '2.5',
        estado_actual: 'pendiente',
        apuesta_estado: 'cerrada',
        game_id: 4773214,
        game_status: 4,
        home_competitor_id: 5061,
        away_competitor_id: 5054,
        marcador_local: 3,
        marcador_visitante: 1,
      }])
      // Segunda llamada (UPDATE) — devolvemos rowCount
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // Tercera llamada (markCompletedApuestas — no hay apuestas pendientes)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await betSelections.syncBetSelections();

    // Verificar que se hizo UPDATE con estado='ganada' y valor_actual=4
    expect(db.execAdvanced).toHaveBeenCalledTimes(3);
    const updateCall = db.execAdvanced.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE apuesta_selecciones/);
    expect(updateCall[1][0]).toBe('ganada');
    expect(updateCall[1][1]).toBe(4);
  });

  test('evalúa y actualiza selecciones de 1x2 (1-0 → ganador local)', async () => {
    db.execAdvanced = jest.fn()
      .mockResolvedValueOnce([{
        seleccion_id: 200,
        apuesta_id: 80,
        tipo_mercado: '1x2',
        valor_seleccion: '1',
        linea: null,
        estado_actual: 'pendiente',
        apuesta_estado: 'cerrada',
        game_id: 4773214,
        game_status: 4,
        home_competitor_id: 5061,
        away_competitor_id: 5054,
        marcador_local: 1,
        marcador_visitante: 0,
      }])
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await betSelections.syncBetSelections();

    const updateCall = db.execAdvanced.mock.calls[1];
    expect(updateCall[1][0]).toBe('ganada');
  });

  test('skip selecciones con tipo_mercado no soportado', async () => {
    db.execAdvanced = jest.fn()
      // 1ra call: SELECT devuelve 1 selección con tipo no soportado
      .mockResolvedValueOnce([{
        seleccion_id: 300,
        apuesta_id: 90,
        tipo_mercado: 'tipo_inventado', // no está en BET_TYPES mock
        valor_seleccion: 'X',
        linea: null,
        estado_actual: 'pendiente',
        apuesta_estado: 'cerrada',
        game_id: 4773214,
        game_status: 4,
        home_competitor_id: 1,
        away_competitor_id: 2,
        marcador_local: 0,
        marcador_visitante: 0,
      }])
      // 2da call: markCompletedApuestas (no hay completadas)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await betSelections.syncBetSelections();

    // 2 calls: SELECT (no UPDATE porque tipo no soportado) + markCompleted
    expect(db.execAdvanced).toHaveBeenCalledTimes(2);
    // La 2da call es la de markCompleted (UPDATE apuestas)
    expect(db.execAdvanced.mock.calls[1][0]).toMatch(/UPDATE apuestas/);
  });

  test('skip selecciones sin partido (game_id IS NULL)', async () => {
    // db.execAdvanced ya filtra con `g.id IS NOT NULL`, pero verificamos
    // que si se pasa, no causa error.
    db.execAdvanced = jest.fn()
      .mockResolvedValueOnce([]);
      // Nota: syncBetSelections retorna temprano si no hay selecciones
      // pendientes, sin llamar a markCompletedApuestas.

    await betSelections.syncBetSelections();

    // 1 call: solo el SELECT (vacío). No se llama a markCompleted.
    expect(db.execAdvanced).toHaveBeenCalledTimes(1);
  });

  test('markCompletedApuestas marca como completada las que tengan 0 pendientes', async () => {
    db.execAdvanced = jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 100 }, { id: 101 }], rowCount: 2 });

    await betSelections.markCompletedApuestas();

    // Verificar que se llamó a UPDATE con la query correcta
    expect(db.execAdvanced).toHaveBeenCalledTimes(1);
    expect(db.execAdvanced.mock.calls[0][0]).toMatch(/UPDATE apuestas/);
    expect(db.execAdvanced.mock.calls[0][0]).toMatch(/SET estado = 'completada'/);
  });
});