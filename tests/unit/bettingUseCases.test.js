/**
 * tests/unit/bettingUseCases.test.js — Verificación de use-cases de betting (Fase 8).
 */

const {
  createAnalizarEnfrentamiento,
  createAnalizarEquipo,
} = require('../../src/application/betting/useCases');

function makeCache(overrides = {}) {
  return {
    getTeamByName: jest.fn(),
    getRecentWorldCupMatchesByTeam: jest.fn(),
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

describe('createAnalizarEnfrentamiento', () => {
  test('throws if cache missing', () => {
    expect(() => createAnalizarEnfrentamiento({})).toThrow(/cache required/);
  });

  test('returns not-found when home team missing', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue(null);
    const uc = createAnalizarEnfrentamiento({ cache, logger: silentLogger });
    expect(await uc('Brasil', 'Argentina')).toMatch(/No encontré al equipo "Brasil"/);
  });

  test('returns not-found when away team missing', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockImplementation(async (name) =>
      name === 'Brasil' ? { id: 100, name: 'Brasil' } : null
    );
    const uc = createAnalizarEnfrentamiento({ cache, logger: silentLogger });
    expect(await uc('Brasil', 'Argentina')).toMatch(/No encontré al equipo "Argentina"/);
  });

  test('returns formatted analysis for both teams', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockImplementation(async (name) =>
      ({ Brasil: { id: 100, name: 'Brasil' }, Argentina: { id: 200, name: 'Argentina' } }[name])
    );
    cache.getRecentWorldCupMatchesByTeam.mockImplementation(async (id) => [
      { homeTeam: 'Brasil', awayTeam: 'Argentina', homeScore: 2, awayScore: 1 },
      { homeTeam: 'Argentina', awayTeam: 'Brasil', homeScore: 0, awayScore: 0 },
    ]);
    const uc = createAnalizarEnfrentamiento({ cache, logger: silentLogger });
    const out = await uc('Brasil', 'Argentina');
    expect(out).toMatch(/Brasil/);
    expect(out).toMatch(/Argentina/);
  });

  test('accepts object form', async () => {
    const cache = makeCache();
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createAnalizarEnfrentamiento({ cache, logger: silentLogger });
    const out = await uc({ id: 100, nombre: 'Brasil' }, { id: 200, nombre: 'Argentina' });
    expect(out).toMatch(/Brasil/);
  });
});

describe('createAnalizarEquipo', () => {
  test('throws if cache missing', () => {
    expect(() => createAnalizarEquipo({})).toThrow(/cache required/);
  });

  test('returns not-found when team missing', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue(null);
    const uc = createAnalizarEquipo({ cache, logger: silentLogger });
    expect(await uc('Brasil')).toMatch(/No encontré al equipo "Brasil"/);
  });

  test('returns formatted analysis for team', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([
      { homeTeam: 'Brasil', awayTeam: 'Argentina', homeScore: 2, awayScore: 1 },
      { homeTeam: 'Francia', awayTeam: 'Brasil', homeScore: 0, awayScore: 1 },
    ]);
    const uc = createAnalizarEquipo({ cache, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/ANÁLISIS: Brasil/);
    expect(out).toMatch(/Últimos 2:/);
    expect(out).toMatch(/Goles\/partido/);
    expect(out).toMatch(/Local:/);
    expect(out).toMatch(/Visitante:/);
  });

  test('handles no matches gracefully', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createAnalizarEquipo({ cache, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/ANÁLISIS: Brasil/);
    expect(out).toMatch(/Últimos 0:/);
  });

  test('accepts object form with buscarDinamico', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createAnalizarEquipo({ cache, logger: silentLogger });
    const out = await uc({ id: 100, nombre: 'Brasil', buscarDinamico: false });
    expect(out).toMatch(/ANÁLISIS: Brasil/);
  });
});
