/**
 * tests/sync.gameTrends.test.js — Fase 3 (mejora de tests)
 *
 * Cubre syncGameTrends (trends por PARTIDO, scope='game'), incluyendo el fix de
 * cobertura POR COMPETICIÓN (row_number/PARTITION BY competition_id, GAMES_PER_COMP)
 * que antes no tenía test directo (el golden solo cubre syncTrends a nivel comp).
 *
 * Mismo patrón de mocks que sync.golden.test.js (dbCapture + scores365 mockeado).
 */

process.env.NODE_ENV = 'test';

jest.mock('../database/connection', () => {
  const c = require('./helpers/dbCapture');
  return { pool: c.pool, withTransaction: c.withTransaction, pgQueryRetry: c.pgQueryRetry, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../database/db', () => require('./helpers/dbCapture').db);
jest.mock('../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../services/scores365Service', () => ({ getTrends: jest.fn() }));
jest.mock('../services/syncCompetitions', () => ({
  getActiveCompetitions: jest.fn(async () => [{ id: 5930 }, { id: 104 }]),
  forEachActive: jest.fn(),
  filterGamesByActiveComps: (g) => g,
}));

const api = require('../services/scores365Service');
const dbCapture = require('./helpers/dbCapture');
const { reset, getWrites, setExecResult } = dbCapture;
const { syncGameTrends } = require('../src/application/sync/trendsOdds');

beforeEach(() => reset());

describe('syncGameTrends — trends por partido (scope=game)', () => {
  test('por cada partido: getTrends("game", gid) + DELETE + INSERT scope=game', async () => {
    setExecResult([{ id: 101 }, { id: 102 }]); // el SELECT de próximos partidos
    api.getTrends.mockImplementation(async (scope, gid) => ({
      trends: [
        { gameId: gid, lineTypeId: 1, text: 'Ganador' },
        { gameId: gid, lineTypeId: 3, text: 'Over/Under' },
      ],
    }));

    await syncGameTrends();

    expect(api.getTrends).toHaveBeenCalledWith('game', 101);
    expect(api.getTrends).toHaveBeenCalledWith('game', 102);

    const writes = getWrites();
    const deletes = writes.filter((w) => /DELETE FROM trends/i.test(w.sql));
    const inserts = writes.filter((w) => /INSERT INTO trends/i.test(w.sql));
    expect(deletes).toHaveLength(2);
    expect(inserts).toHaveLength(2);
    expect(deletes[0].params).toEqual(['game', 101]); // borra solo scope=game de ese partido
    expect(inserts[0].params[0]).toBe('game');          // scope
    expect(inserts[0].params).toHaveLength(10);         // 2 trends × 5 columnas
  });

  test('query de partidos es POR COMPETICIÓN (row_number/PARTITION, GAMES_PER_COMP=8)', async () => {
    setExecResult([]);
    const execSpy = jest.spyOn(dbCapture.db, 'execAdvanced');

    await syncGameTrends();

    const selectCall = execSpy.mock.calls.find((c) => /FROM games/i.test(c[0]));
    expect(selectCall).toBeDefined();
    expect(selectCall[0]).toMatch(/row_number\(\) OVER \(PARTITION BY competition_id/i);
    expect(selectCall[0]).toMatch(/rn <= \$2/);
    expect(selectCall[1]).toEqual([[5930, 104], 8]); // [ids de comps activas, GAMES_PER_COMP]

    execSpy.mockRestore();
  });

  test('partido sin trends → DELETE pero sin INSERT (limpia stale, no inserta vacío)', async () => {
    setExecResult([{ id: 200 }]);
    api.getTrends.mockResolvedValue({ trends: [] });

    await syncGameTrends();

    const writes = getWrites();
    expect(writes.filter((w) => /DELETE FROM trends/i.test(w.sql))).toHaveLength(1);
    expect(writes.filter((w) => /INSERT INTO trends/i.test(w.sql))).toHaveLength(0);
  });

  test('un partido que falla no tumba el resto (try/catch por partido)', async () => {
    setExecResult([{ id: 301 }, { id: 302 }]);
    api.getTrends.mockImplementation(async (scope, gid) => {
      if (gid === 301) throw new Error('upstream 500');
      return { trends: [{ gameId: gid, lineTypeId: 1 }] };
    });

    await expect(syncGameTrends()).resolves.toBeUndefined();

    const inserts = getWrites().filter((w) => /INSERT INTO trends/i.test(w.sql));
    expect(inserts).toHaveLength(1); // solo el 302
  });
});
