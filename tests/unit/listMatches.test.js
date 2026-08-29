/**
 * tests/unit/listMatches.test.js — Verificación de use-cases de matches (Fase 8).
 */

const {
  createGetPartidosHoy,
  createGetPartidosFecha,
  createGetResultadoEquipo,
  createGetProximosEquipo,
  createGetResultadoVS,
} = require('../../src/application/matches/listMatches');

function makeCache(overrides = {}) {
  return {
    getWorldCupGames: jest.fn(),
    getTeamByName: jest.fn(),
    getRecentWorldCupMatchesByTeam: jest.fn(),
    findGameByCompetitors: jest.fn(),
    getMatchH2H: jest.fn(),
    COMPETITION_ID: 7,
    ...overrides,
  };
}

function makeScores365UseCases(overrides = {}) {
  return {
    getTipPartido: jest.fn(),
    getTendenciasByTeams: jest.fn(),
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

describe('createGetPartidosHoy', () => {
  test('throws if cache missing', () => {
    expect(() => createGetPartidosHoy({ getCompetitionName: jest.fn() })).toThrow(/cache required/);
  });

  test('returns no-matches message when empty', async () => {
    const cache = makeCache();
    cache.getWorldCupGames.mockResolvedValue([]);
    const getCompetitionName = jest.fn().mockResolvedValue('Copa');
    const uc = createGetPartidosHoy({ cache, getCompetitionName, logger: silentLogger });
    const out = await uc();
    expect(out).toMatch(/No hay partidos programados/);
    expect(out).toMatch(/Copa/);
  });

  test('groups matches by stage name', async () => {
    const cache = makeCache();
    cache.getWorldCupGames.mockResolvedValue([
      { homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Argentina' }, stageName: 'Group A', startTime: '2026-01-01T18:00:00Z' },
      { homeCompetitor: { name: 'México' }, awayCompetitor: { name: 'Canadá' }, stageName: 'Group B', startTime: '2026-01-01T20:00:00Z' },
      { homeCompetitor: { name: 'España' }, awayCompetitor: { name: 'Francia' }, stageName: 'Cuartos de final', startTime: '2026-02-01T18:00:00Z' },
    ]);
    const getCompetitionName = jest.fn().mockResolvedValue('Copa');
    const uc = createGetPartidosHoy({ cache, getCompetitionName, logger: silentLogger });
    const out = await uc();
    expect(out).toMatch(/📋 \*A\*/);
    expect(out).toMatch(/📋 \*B\*/);
    expect(out).toMatch(/📋 \*Cuartos\*/);
  });

  test('shows score when present', async () => {
    const cache = makeCache();
    cache.getWorldCupGames.mockResolvedValue([
      { homeCompetitor: { name: 'Brasil', score: 2 }, awayCompetitor: { name: 'Argentina', score: 1 }, stageName: 'Group A', startTime: '2026-01-01T18:00:00Z' },
    ]);
    const uc = createGetPartidosHoy({ cache, getCompetitionName: jest.fn().mockResolvedValue('Copa'), logger: silentLogger });
    const out = await uc();
    expect(out).toMatch(/Brasil 2 - 1 Argentina/);
  });
});

describe('createGetPartidosFecha', () => {
  test('throws if cache missing', () => {
    expect(() => createGetPartidosFecha({})).toThrow(/cache required/);
  });

  test('returns help when no arg', async () => {
    const uc = createGetPartidosFecha({ cache: makeCache(), logger: silentLogger });
    const out = await uc(null);
    expect(out).toMatch(/Para ver partidos de una fecha específica/);
  });

  test('returns no-partidos when cache empty', async () => {
    const cache = makeCache();
    cache.getWorldCupGames.mockResolvedValue([]);
    const uc = createGetPartidosFecha({ cache, logger: silentLogger });
    const out = await uc('20260101');
    expect(out).toMatch(/No encontré partidos/);
  });

  test('accepts YYYYMMDD format', async () => {
    const cache = makeCache();
    cache.getWorldCupGames.mockResolvedValue([
      { homeCompetitor: { name: 'A' }, awayCompetitor: { name: 'B' }, stageName: 'Group A', startTime: '18:00' },
    ]);
    const uc = createGetPartidosFecha({ cache, logger: silentLogger });
    const out = await uc('20260101');
    expect(out).toMatch(/A vs B/);
    expect(out).toMatch(/2026-01-01/);
  });

  test('rejects invalid date', async () => {
    const uc = createGetPartidosFecha({ cache: makeCache(), logger: silentLogger });
    const out = await uc('not-a-date');
    expect(out).toMatch(/No pude interpretar la fecha/);
  });

  test('accepts today/tomorrow/yesterday tokens', async () => {
    const cache = makeCache();
    cache.getWorldCupGames.mockResolvedValue([]);
    const uc = createGetPartidosFecha({ cache, logger: silentLogger });
    expect(await uc('today')).toMatch(/No encontré partidos/);
    expect(await uc('tomorrow')).toMatch(/No encontré partidos/);
    expect(await uc('yesterday')).toMatch(/No encontré partidos/);
  });
});

describe('createGetResultadoEquipo', () => {
  const scores365 = makeScores365UseCases();

  test('throws if cache missing', () => {
    expect(() => createGetResultadoEquipo({})).toThrow(/cache required/);
  });

  test('returns error when teamName empty', async () => {
    const uc = createGetResultadoEquipo({ cache: makeCache(), scores365UseCases: scores365, logger: silentLogger });
    expect(await uc('')).toMatch(/No especificaste el equipo/);
  });

  test('returns not-found when team lookup fails', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue(null);
    const uc = createGetResultadoEquipo({ cache, scores365UseCases: scores365, logger: silentLogger });
    expect(await uc('Brasil')).toMatch(/No encontré al equipo/);
  });

  test('returns not-found when no matches', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createGetResultadoEquipo({ cache, scores365UseCases: scores365, logger: silentLogger });
    expect(await uc('Brasil')).toMatch(/No encontré partidos recientes/);
  });

  test('shows last 3 matches with status', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([
      { id: 1, homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2026-01-02T18:00:00Z' },
      { id: 2, homeCompetitor: { id: 300, name: 'Francia', score: 0 }, awayCompetitor: { id: 100, name: 'Brasil', score: 0 }, startTime: '2026-01-01T18:00:00Z' },
    ]);
    const uc = createGetResultadoEquipo({ cache, scores365UseCases: scores365, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/ÚLTIMOS PARTIDOS - BRASIL/);
    expect(out).toMatch(/Sigue en competencia/);
  });

  test('accepts object form', async () => {
    const cache = makeCache();
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createGetResultadoEquipo({ cache, scores365UseCases: scores365, logger: silentLogger });
    expect(await uc({ id: 100, nombre: 'Brasil' })).toMatch(/No encontré partidos recientes/);
  });
});

describe('createGetProximosEquipo', () => {
  test('throws if cache missing', () => {
    expect(() => createGetProximosEquipo({})).toThrow(/cache required/);
  });

  test('returns error when teamName empty', async () => {
    const uc = createGetProximosEquipo({ cache: makeCache(), logger: silentLogger });
    expect(await uc('')).toMatch(/No especificaste el equipo/);
  });

  test('returns no-upcoming when none', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const uc = createGetProximosEquipo({ cache, logger: silentLogger });
    expect(await uc('Brasil')).toMatch(/Sin partidos próximos/);
  });

  test('shows upcoming matches', async () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue({ id: 100, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([
      { id: 1, homeCompetitor: { id: 100, name: 'Brasil' }, awayCompetitor: { id: 200, name: 'Argentina' }, startTime: future, stageName: 'Group A' },
    ]);
    const uc = createGetProximosEquipo({ cache, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/PRÓXIMOS PARTIDOS - BRASIL/);
    expect(out).toMatch(/LOCAL/);
    expect(out).toMatch(/Brasil vs Argentina/);
  });
});

describe('createGetResultadoVS', () => {
  const scores365 = makeScores365UseCases();

  test('throws if cache missing', () => {
    expect(() => createGetResultadoVS({ scores365UseCases: scores365 })).toThrow(/cache required/);
  });

  test('throws if scores365UseCases missing', () => {
    expect(() => createGetResultadoVS({ cache: makeCache() })).toThrow(/scores365UseCases required/);
  });

  test('returns error when home team not found', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockResolvedValue(null);
    const uc = createGetResultadoVS({ cache, scores365UseCases: scores365, logger: silentLogger });
    expect(await uc('Brasil', 'Argentina')).toMatch(/No encontré al equipo "Brasil"/);
  });

  test('returns error when away team not found', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockImplementation(async (name) =>
      name === 'Brasil' ? { id: 100, name: 'Brasil' } : null
    );
    const uc = createGetResultadoVS({ cache, scores365UseCases: scores365, logger: silentLogger });
    expect(await uc('Brasil', 'Argentina')).toMatch(/No encontré al equipo "Argentina"/);
  });

  test('returns H2H matches when available', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockImplementation(async (name) =>
      ({ Brasil: { id: 100, name: 'Brasil' }, Argentina: { id: 200, name: 'Argentina' } }[name])
    );
    cache.getMatchH2H.mockResolvedValue({
      h2hGames: [
        { id: 1, homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2025-01-01T18:00:00Z' },
      ],
    });
    const uc = createGetResultadoVS({ cache, scores365UseCases: scores365, logger: silentLogger });
    const out = await uc('Brasil', 'Argentina');
    expect(out).toMatch(/ENFRENTAMIENTOS — BRASIL VS ARGENTINA/);
    expect(out).toMatch(/Últimos 1 enfrentamientos/);
  });

  test('returns no-data when H2H and tips both empty', async () => {
    const cache = makeCache();
    cache.getTeamByName.mockImplementation(async (name) =>
      ({ Brasil: { id: 100, name: 'Brasil' }, Argentina: { id: 200, name: 'Argentina' } }[name])
    );
    cache.getMatchH2H.mockResolvedValue({ h2hGames: [] });
    cache.findGameByCompetitors.mockResolvedValue(null);
    const uc = createGetResultadoVS({ cache, scores365UseCases: scores365, logger: silentLogger });
    expect(await uc('Brasil', 'Argentina')).toMatch(/No encontré enfrentamientos directos/);
  });
});
