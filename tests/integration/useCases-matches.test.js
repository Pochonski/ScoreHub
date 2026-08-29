/**
 * tests/integration/useCases-matches.test.js (T2b)
 *
 * Integration test para matchesList contra DB captura + cache mockeado
 * + scores365UseCases wrapper. Verifica los 5 use-cases de matches:
 *   - createGetPartidosHoy
 *   - createGetPartidosFecha
 *   - createGetResultadoEquipo
 *   - createGetProximosEquipo
 *   - createGetResultadoVS
 */

process.env.NODE_ENV = 'test';

jest.mock('../../database/connection', () => {
  const c = require('./helpers/dbCapture');
  return { pool: c.pool, withTransaction: c.withTransaction, pgQueryRetry: c.pgQueryRetry, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../../database/db', () => require('./helpers/dbCapture').db);

const capture = require('./helpers/dbCapture');
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

function makeScores365(overrides = {}) {
  return {
    getTipPartido: jest.fn().mockResolvedValue('🔮 TIP: Gana Brasil'),
    getTendenciasByTeams: jest.fn().mockResolvedValue('📈 Tendencia: 60% home win'),
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

beforeEach(() => { capture.reset(); });

describe('createGetPartidosHoy', () => {
  test('lista vacía devuelve mensaje "no hay partidos"', async () => {
    const cache = makeCache({ getWorldCupGames: jest.fn().mockResolvedValue([]) });
    const uc = createGetPartidosHoy({ cache, getCompetitionName: jest.fn().mockResolvedValue('Copa'), logger: silentLogger });
    const out = await uc();
    expect(out).toMatch(/No hay partidos/);
  });

  test('agrupa por stage detectado del stageName', async () => {
    const cache = makeCache({
      getWorldCupGames: jest.fn().mockResolvedValue([
        { homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Argentina' }, stageName: 'Group A', startTime: '2026-01-01T18:00:00Z' },
        { homeCompetitor: { name: 'México' }, awayCompetitor: { name: 'Canadá' }, stageName: 'Group B', startTime: '2026-01-01T20:00:00Z' },
      ]),
    });
    const uc = createGetPartidosHoy({ cache, getCompetitionName: jest.fn().mockResolvedValue('Copa'), logger: silentLogger });
    const out = await uc();
    expect(out).toMatch(/📋 \*A\*/);
    expect(out).toMatch(/📋 \*B\*/);
  });
});

describe('createGetPartidosFecha', () => {
  test('null → mensaje de ayuda', async () => {
    const uc = createGetPartidosFecha({ cache: makeCache(), logger: silentLogger });
    const out = await uc(null);
    expect(out).toMatch(/Para ver partidos de una fecha/);
  });

  test('fecha inválida → error', async () => {
    const uc = createGetPartidosFecha({ cache: makeCache(), logger: silentLogger });
    const out = await uc('not-a-date');
    expect(out).toMatch(/No pude interpretar la fecha/);
  });

  test('fecha YYYYMMDD válida', async () => {
    const cache = makeCache({
      getWorldCupGames: jest.fn().mockResolvedValue([
        { homeCompetitor: { name: 'A' }, awayCompetitor: { name: 'B' }, stageName: 'Group A', startTime: '18:00' },
      ]),
    });
    const uc = createGetPartidosFecha({ cache, logger: silentLogger });
    const out = await uc('20260101');
    expect(out).toMatch(/A vs B/);
    expect(out).toMatch(/2026-01-01/);
  });
});

describe('createGetResultadoEquipo', () => {
  test('sin resultados devuelve mensaje de error', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([]),
    });
    const scores365 = makeScores365();
    const uc = createGetResultadoEquipo({ cache, scores365UseCases: scores365, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/No encontré partidos recientes/);
  });

  test('con resultados muestra últimos partidos', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([
        { id: 1, homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2026-01-02T18:00:00Z' },
        { id: 2, homeCompetitor: { id: 300, name: 'Francia', score: 0 }, awayCompetitor: { id: 100, name: 'Brasil', score: 0 }, startTime: '2026-01-01T18:00:00Z' },
      ]),
    });
    const uc = createGetResultadoEquipo({ cache, scores365UseCases: makeScores365(), logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/ÚLTIMOS PARTIDOS - BRASIL/);
    expect(out).toMatch(/Sigue en competencia/);
  });
});

describe('createGetProximosEquipo', () => {
  test('sin próximos devuelve mensaje', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([]),
    });
    const uc = createGetProximosEquipo({ cache, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/Sin partidos próximos/);
  });

  test('con partidos próximos los lista', async () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([
        { id: 1, homeCompetitor: { id: 100, name: 'Brasil' }, awayCompetitor: { id: 200, name: 'Argentina' }, startTime: future, stageName: 'Group A' },
      ]),
    });
    const uc = createGetProximosEquipo({ cache, logger: silentLogger });
    const out = await uc('Brasil');
    expect(out).toMatch(/PRÓXIMOS PARTIDOS - BRASIL/);
    expect(out).toMatch(/Brasil vs Argentina/);
  });
});

describe('createGetResultadoVS', () => {
  test('sin datos devuelve mensaje', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockImplementation(async (name) =>
        ({ Brasil: { id: 100, name: 'Brasil' }, Argentina: { id: 200, name: 'Argentina' } }[name])),
      getMatchH2H: jest.fn().mockResolvedValue({ h2hGames: [] }),
      findGameByCompetitors: jest.fn().mockResolvedValue(null),
    });
    const uc = createGetResultadoVS({ cache, scores365UseCases: makeScores365(), logger: silentLogger });
    const out = await uc('Brasil', 'Argentina');
    expect(out).toMatch(/No encontré enfrentamientos/);
  });

  test('con H2H muestra últimos enfrentamientos', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockImplementation(async (name) =>
        ({ Brasil: { id: 100, name: 'Brasil' }, Argentina: { id: 200, name: 'Argentina' } }[name])),
      getMatchH2H: jest.fn().mockResolvedValue({
        h2hGames: [
          { id: 1, homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2025-01-01T18:00:00Z' },
        ],
      }),
    });
    const uc = createGetResultadoVS({ cache, scores365UseCases: makeScores365(), logger: silentLogger });
    const out = await uc('Brasil', 'Argentina');
    expect(out).toMatch(/ENFRENTAMIENTOS — BRASIL VS ARGENTINA/);
  });
});
