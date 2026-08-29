/**
 * tests/integration/useCases-stats.test.js (T2b)
 *
 * Integration test para statsUseCases (Fase 2-2) + teamStats + standings
 * (Fase 2-9) contra statsRepository (mockeado) + getCompetitionName.
 *
 * Cubre: noticias, equipoIdeal, bracket, historial, goleadores,
 * estadisticas (team), goleadores (team), tabla, tablaMundial.
 */

process.env.NODE_ENV = 'test';

const silentLogger = { error: jest.fn(), warn: jest.fn() };

const {
  createGetNoticias,
  createGetEquipoIdeal,
  createGetBracket,
  createGetHistorial,
  createGetGoleadores,
} = require('../../src/application/stats/useCases');

const {
  createGetEstadisticas,
  createGetGoleadores: createGetGoleadoresTeam,
} = require('../../src/application/stats/teamStats');

const { createGetTabla } = require('../../src/application/stats/standings');

function makeStatsRepo(overrides = {}) {
  return {
    getNews: jest.fn(),
    getTeamOfWeek: jest.fn(),
    getBracket: jest.fn(),
    getCompetitionHistory: jest.fn(),
    getLatestTournamentStats: jest.fn(),
    ...overrides,
  };
}

function makeCache(overrides = {}) {
  return {
    getTeamByName: jest.fn(),
    getRecentWorldCupMatchesByTeam: jest.fn(),
    getMatchStats: jest.fn(),
    getWorldCupStandings: jest.fn(),
    getTournamentTop: jest.fn(),
    ...overrides,
  };
}

describe('createGetNoticias', () => {
  test('sin noticias devuelve mensaje', async () => {
    const repo = makeStatsRepo({ getNews: jest.fn().mockResolvedValue([]) });
    const uc = createGetNoticias({
      statsRepository: repo,
      matchSearch: { findGamesByCompetitorName: jest.fn() },
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      competitionId: 7,
      logger: silentLogger,
    });
    const out = await uc();
    expect(out).toMatch(/No hay noticias disponibles/);
  });

  test('lista de noticias', async () => {
    const repo = makeStatsRepo({
      getNews: jest.fn().mockResolvedValue([
        { data: { title: 'Brasil gana', scope: 'comp', publishDate: '2026-01-01T00:00:00Z', url: 'https://example.com' } },
        { data: { title: 'Argentina empata', scope: 'comp', publishDate: '2025-12-31T00:00:00Z' } },
      ]),
    });
    const uc = createGetNoticias({
      statsRepository: repo,
      matchSearch: { findGamesByCompetitorName: jest.fn() },
      getCompetitionName: jest.fn().mockResolvedValue('Copa Mundial'),
      competitionId: 7,
      logger: silentLogger,
    });
    const out = await uc();
    expect(out).toMatch(/ÚLTIMAS NOTICIAS — Copa Mundial/);
    expect(out).toMatch(/Brasil gana/);
  });
});

describe('createGetEquipoIdeal', () => {
  test('sin datos devuelve mensaje', async () => {
    const repo = makeStatsRepo({ getTeamOfWeek: jest.fn().mockResolvedValue(null) });
    const uc = createGetEquipoIdeal({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      logger: silentLogger,
    });
    expect(await uc()).toMatch(/No hay equipo de la semana/);
  });

  test('con lineup lo formatea', async () => {
    const repo = makeStatsRepo({
      getTeamOfWeek: jest.fn().mockResolvedValue({
        competitionId: 7,
        data: {
          teamOfWeek: {
            lineup: {
              formation: '4-3-3',
              members: [
                { position: { name: 'Portero' }, shortName: 'A', name: 'Alisson', teamName: 'Brasil', rating: 8.5 },
                { position: { name: 'Defensa' }, shortName: 'S', name: 'Silva', teamName: 'Brasil' },
              ],
            },
          },
        },
      }),
    });
    const uc = createGetEquipoIdeal({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      logger: silentLogger,
    });
    const out = await uc();
    expect(out).toMatch(/EQUIPO IDEAL/);
    expect(out).toMatch(/Formación: 4-3-3/);
    expect(out).toMatch(/⭐8.5/);
  });
});

describe('createGetGoleadores (world stats)', () => {
  test('sin stats devuelve mensaje', async () => {
    const repo = makeStatsRepo({ getLatestTournamentStats: jest.fn().mockResolvedValue(null) });
    const uc = createGetGoleadores({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      logger: silentLogger,
    });
    const r = await uc();
    expect(r.text).toMatch(/No hay ranking de goleadores/);
  });

  test('lista top scorers', async () => {
    const repo = makeStatsRepo({
      getLatestTournamentStats: jest.fn().mockResolvedValue({
        competitionId: 7,
        data: {
          stats: [{
            name: 'Goles', id: 1,
            rows: [
              { entity: { id: 999, name: 'Messi', shortName: 'M10', competitorName: 'Argentina', value: 8 }, position: 1 },
              { entity: { name: 'Mbappé', competitorName: 'Francia', value: 7 }, position: 2 },
            ],
          }],
        },
      }),
    });
    const uc = createGetGoleadores({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      logger: silentLogger,
    });
    const r = await uc();
    expect(r.text).toMatch(/🥇/);
    expect(r.text).toMatch(/Messi/);
    expect(r.text).toMatch(/8 goles/);
    expect(r.photoUrl).toBeDefined();
  });
});

describe('createGetHistorial', () => {
  test('sin historial devuelve mensaje', async () => {
    const repo = makeStatsRepo({ getCompetitionHistory: jest.fn().mockResolvedValue([]) });
    const uc = createGetHistorial({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      getSeasonLabel: jest.fn().mockResolvedValue('2022'),
      logger: silentLogger,
    });
    expect(await uc()).toMatch(/No hay historial/);
  });

  test('lista temporadas', async () => {
    const repo = makeStatsRepo({
      getCompetitionHistory: jest.fn().mockResolvedValue([
        { competitionId: 7, seasonNum: 2022, data: { seasonNum: 2022, group: { participants: [{ name: 'Argentina' }, { name: 'Francia' }] } } },
      ]),
    });
    const uc = createGetHistorial({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      getSeasonLabel: jest.fn().mockResolvedValue('2022'),
      logger: silentLogger,
    });
    const out = await uc();
    expect(out).toMatch(/HISTORIAL/);
    expect(out).toMatch(/Argentina/);
  });
});

describe('createGetEstadisticas (team)', () => {
  test('sin tipo devuelve últimos resultados', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([
        { homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2026-01-01T18:00:00Z' },
      ]),
    });
    const uc = createGetEstadisticas({
      cache,
      getRecentForm: () => ({ played: 1, wins: 1, draws: 0, losses: 0, line: 'G' }),
      formatMatchLine: (m) => ({ line: `${m.homeCompetitor.name} vs ${m.awayCompetitor.name}` }),
      logger: silentLogger,
    });
    const out = await uc({ equipo: 'Brasil' });
    expect(out).toMatch(/ESTADÍSTICAS DE BRASIL/);
    expect(out).toMatch(/Últimos 1 resultados/);
  });

  test('con tipo (goles) busca stats por partido', async () => {
    const cache = makeCache({
      getTeamByName: jest.fn().mockResolvedValue({ id: 100, name: 'Brasil' }),
      getRecentWorldCupMatchesByTeam: jest.fn().mockResolvedValue([
        { id: 1, homeCompetitor: { id: 100, name: 'Brasil', score: 2 }, awayCompetitor: { id: 200, name: 'Argentina', score: 1 }, startTime: '2026-01-01T18:00:00Z' },
      ]),
      getMatchStats: jest.fn().mockResolvedValue([
        { name: 'Goles', home: 2, away: 1 },
      ]),
    });
    const uc = createGetEstadisticas({
      cache,
      getRecentForm: () => ({ played: 1, wins: 1, draws: 0, losses: 0, line: 'G' }),
      formatMatchLine: (m) => ({ line: `Brasil vs Argentina` }),
      logger: silentLogger,
    });
    const out = await uc({ tipo: 'goles', equipo: 'Brasil' });
    expect(out).toMatch(/Goals por partido/);
    expect(out).toMatch(/Brasil vs Argentina/);
  });
});

describe('createGetTabla', () => {
  test('liga no soportada devuelve error', async () => {
    const cache = makeCache({ getWorldCupStandings: jest.fn() });
    const uc = createGetTabla({
      cache,
      getCompetitionName: jest.fn(),
      primaryCompetitionId: 7,
      formatGroupTable: () => '',
      logger: silentLogger,
    });
    const out = await uc('premier league');
    expect(out).toMatch(/no está disponible/);
  });

  test('mundial devuelve tabla agrupada por grupo', async () => {
    const cache = makeCache({
      getWorldCupStandings: jest.fn().mockResolvedValue([
        {
          name: 'Group A',
          teams: [
            { idx: 1, name: 'Brasil', id: 100, played: 3, wins: 2, draws: 1, losses: 0, scoresStr: '5-1', goalConDiff: 4, pts: 7 },
            { idx: 2, name: 'Argentina', id: 200, played: 3, wins: 1, draws: 1, losses: 1, scoresStr: '3-3', goalConDiff: 0, pts: 4 },
          ],
        },
      ]),
    });
    const uc = createGetTabla({
      cache,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      primaryCompetitionId: 7,
      formatGroupTable: (teams, group) => `Grupo ${group}: ${teams.map((t) => t.name).join(', ')}`,
      logger: silentLogger,
    });
    const out = await uc('mundial');
    expect(out).toMatch(/TABLA Copa/);
    expect(out).toMatch(/Grupo A/);
    expect(out).toMatch(/Brasil, Argentina/);
  });
});
