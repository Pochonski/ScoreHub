/**
 * tests/unit/mundialCache.test.js — Verifica que las queries del cache
 * aplican los LIMITs añadidos en Fase egress-2026. Evita regresiones
 * silenciosas: si alguien remueve un LIMIT, el test lo detecta.
 *
 * Mockeamos database/db.execAdvanced para inspeccionar la SQL generada.
 */

jest.mock('../../database/db', () => ({
  execAdvanced: jest.fn(),
}));

const db = require('../../database/db');
const cache = require('../../services/mundialCache');

beforeEach(() => {
  db.execAdvanced.mockReset();
  db.execAdvanced.mockResolvedValue([{ data: {} }]);
  cache.clear();
});

describe('mundialCache — LIMIT guards (Fase egress-2026)', () => {
  test('getRecentWorldCupMatchesByTeam: SQL incluye LIMIT 30 literal', async () => {
    await cache.getRecentWorldCupMatchesByTeam(123);
    expect(db.execAdvanced).toHaveBeenCalledTimes(1);
    const [sql, params] = db.execAdvanced.mock.calls[0];
    expect(sql).toMatch(/LIMIT\s+30\b/i);
    expect(params).toEqual([expect.any(Number), 123]);
  });

  test('getRecentWorldCupGames: SQL incluye LIMIT con el limit param', async () => {
    await cache.getRecentWorldCupGames({ limit: 50 });
    const [sql, params] = db.execAdvanced.mock.calls[0];
    expect(sql).toMatch(/LIMIT\s+\$2/i);
    expect(params).toEqual([expect.any(Number), 50]);
  });

  test('getRecentWorldCupGames: usa 88 por default si no se pasa limit', async () => {
    await cache.getRecentWorldCupGames();
    const [, params] = db.execAdvanced.mock.calls[0];
    expect(params).toEqual([expect.any(Number), 88]);
  });

  test('searchAthletes loader: SQL restringe a últimos 90 días', async () => {
    // searchAthletes dispara el loader internamente; el loader hace
    // db.execAdvanced una vez para jalar overviews recientes.
    await cache.searchAthletes('messi');
    // Buscar el call cuyo SQL tenga el subquery de game_overviews
    const overviewCall = db.execAdvanced.mock.calls.find(([sql]) =>
      /game_overviews/.test(sql)
    );
    expect(overviewCall).toBeDefined();
    const [sql] = overviewCall;
    expect(sql).toMatch(/start_time\s*>=\s*now\(\)\s*-\s*interval\s*'90 days'/i);
  });

  test('getMatchStats: TTL configurado a 5 minutos', async () => {
    // Llamar dos veces en <5min debe usar el cache (1 sola llamada a DB).
    await cache.getMatchStats(99);
    await cache.getMatchStats(99);
    await cache.getMatchStats(99);
    expect(db.execAdvanced).toHaveBeenCalledTimes(1);
  });
});
