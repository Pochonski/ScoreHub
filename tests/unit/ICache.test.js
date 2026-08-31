/**
 * tests/unit/ICache.test.js — Verificación del puerto ICache + adapter.
 */

const { createCache, REQUIRED_METHODS } = require('../../src/domain/ports/ICache');
const { createCacheAdapter } = require('../../src/infrastructure/cache/CacheAdapter');

function makeAdapter(overrides = {}) {
  return {
    COMPETITION_ID: 7,
    getWorldCupGames: jest.fn(),
    getWorldCupStandings: jest.fn(),
    getRecentWorldCupMatchesByTeam: jest.fn(),
    getMatchStats: jest.fn(),
    getTeamByName: jest.fn(),
    findGameByCompetitors: jest.fn(),
    getTournamentTop: jest.fn(),
    getGameById: jest.fn(),
    ...overrides,
  };
}

describe('createCache — Proxy enforcement', () => {
  test('throws if adapter is not an object', () => {
    expect(() => createCache(null)).toThrow(/adapter must be an object/);
  });

  test('REQUIRED_METHODS has 8 entries (matches legacy surface)', () => {
    expect(REQUIRED_METHODS.length).toBe(8);
    expect(REQUIRED_METHODS).toContain('getWorldCupGames');
    expect(REQUIRED_METHODS).toContain('getTournamentTop');
    expect(REQUIRED_METHODS).toContain('getGameById');
  });

  test('passes through all required methods', async () => {
    const adapter = makeAdapter({
      getWorldCupGames: jest.fn().mockResolvedValue([{ id: 1 }]),
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
    });
    const cache = createCache(adapter);
    expect(await cache.getWorldCupGames()).toEqual([{ id: 1 }]);
    expect(adapter.getWorldCupGames).toHaveBeenCalled();
    expect(await cache.getTeamByName('Brasil')).toEqual({ id: 100, name: 'Brasil' });
  });

  test('throws at access time if required method missing', () => {
    const adapter = makeAdapter();
    delete adapter.getTournamentTop;
    const cache = createCache(adapter);
    expect(() => cache.getTournamentTop()).toThrow(/is not implemented/);
  });
});

describe('createCacheAdapter', () => {
  test('throws if legacy module missing', () => {
    expect(() => createCacheAdapter(null)).toThrow(/legacyModule required/);
  });

  test('validates boot-time', () => {
    const adapter = makeAdapter();
    delete adapter.getGameById;
    expect(() => createCacheAdapter(adapter)).toThrow(/getGameById is not a function/);
  });

  test('wraps legacy with createCache', async () => {
    const adapter = makeAdapter({
      getWorldCupGames: jest.fn().mockResolvedValue([{ id: 42 }]),
    });
    const wrapped = createCacheAdapter(adapter);
    expect(await wrapped.getWorldCupGames()).toEqual([{ id: 42 }]);
  });
});
