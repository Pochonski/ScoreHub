/**
 * tests/unit/statsUseCases.test.js — Verificación de use-cases de stats (Fase 8).
 */

const {
  createGetNoticias,
  createGetEquipoIdeal,
  createGetBracket,
  createGetHistorial,
  createGetGoleadores,
} = require('../../src/application/stats/useCases');

function makeRepo(overrides = {}) {
  return {
    getNews: jest.fn(),
    getTeamOfWeek: jest.fn(),
    getBracket: jest.fn(),
    getCompetitionHistory: jest.fn(),
    getLatestTournamentStats: jest.fn(),
    ...overrides,
  };
}

const COMPETITION_ID = 7;

describe('createGetNoticias', () => {
  test('throws if statsRepository missing', () => {
    expect(() => createGetNoticias({ competitionId: COMPETITION_ID })).toThrow(/statsRepository required/);
  });

  test('throws if competitionId missing', () => {
    expect(() => createGetNoticias({ statsRepository: makeRepo() })).toThrow(/competitionId required/);
  });

  test('returns empty message when no news', async () => {
    const repo = makeRepo();
    repo.getNews.mockResolvedValue([]);
    const getCompetitionName = jest.fn().mockResolvedValue('Copa');
    const uc = createGetNoticias({
      statsRepository: repo, matchSearch: { findGamesByCompetitorName: jest.fn() },
      getCompetitionName, competitionId: COMPETITION_ID,
    });
    const out = await uc({ limit: 10 });
    expect(out).toMatch(/No hay noticias disponibles/);
  });

  test('returns formatted list when news available', async () => {
    const repo = makeRepo();
    repo.getNews.mockResolvedValue([
      { data: { title: 'Brasil gana', scope: 'comp', publishDate: '2026-01-01T00:00:00Z', url: 'https://example.com' } },
      { data: { title: 'Argentina empata', scope: 'comp', publishDate: '2025-12-31T00:00:00Z' } },
    ]);
    const getCompetitionName = jest.fn().mockResolvedValue('Copa Mundial');
    const uc = createGetNoticias({
      statsRepository: repo, matchSearch: { findGamesByCompetitorName: jest.fn() },
      getCompetitionName, competitionId: COMPETITION_ID,
    });
    const out = await uc({ limit: 10 });
    expect(out).toMatch(/ÚLTIMAS NOTICIAS — Copa Mundial/);
    expect(out).toMatch(/Brasil gana/);
    expect(out).toMatch(/https:\/\/example.com/);
    expect(out).not.toMatch(/<[^>]+>/); // HTML stripped
  });

  test('filters news by team when equipo provided', async () => {
    const repo = makeRepo();
    repo.getNews.mockResolvedValue([
      { data: { title: 'Brasil gana', scope: 'comp', publishDate: '2026-01-01T00:00:00Z' } },
    ]);
    const matchSearch = { findGamesByCompetitorName: jest.fn().mockResolvedValue([]) };
    const getCompetitionName = jest.fn().mockResolvedValue('Copa');
    const uc = createGetNoticias({
      statsRepository: repo, matchSearch, getCompetitionName, competitionId: COMPETITION_ID,
    });
    const out = await uc({ equipo: 'Brasil', limit: 10 });
    expect(out).toMatch(/No encontré partidos de \*Brasil\*/);
  });

  test('returns error message on exception', async () => {
    const repo = makeRepo();
    repo.getNews.mockRejectedValue(new Error('DB timeout'));
    const uc = createGetNoticias({
      statsRepository: repo, matchSearch: { findGamesByCompetitorName: jest.fn() },
      getCompetitionName: jest.fn(), competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out).toMatch(/No pude obtener noticias: DB timeout/);
  });
});

describe('createGetEquipoIdeal', () => {
  test('returns empty message when no data', async () => {
    const repo = makeRepo();
    repo.getTeamOfWeek.mockResolvedValue(null);
    const uc = createGetEquipoIdeal({ statsRepository: repo, getCompetitionName: jest.fn(), competitionId: COMPETITION_ID });
    expect(await uc()).toMatch(/No hay equipo de la semana/);
  });

  test('returns empty when lineup missing', async () => {
    const repo = makeRepo();
    repo.getTeamOfWeek.mockResolvedValue({ competitionId: COMPETITION_ID, data: { lineup: {} } });
    const uc = createGetEquipoIdeal({ statsRepository: repo, getCompetitionName: jest.fn(), competitionId: COMPETITION_ID });
    expect(await uc()).toMatch(/No hay equipo de la semana/);
  });

  test('returns formatted team when valid data', async () => {
    const repo = makeRepo();
    repo.getTeamOfWeek.mockResolvedValue({
      competitionId: COMPETITION_ID,
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
    });
    const uc = createGetEquipoIdeal({
      statsRepository: repo, getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out).toMatch(/EQUIPO IDEAL — Copa/);
    expect(out).toMatch(/Formación: 4-3-3/);
    expect(out).toMatch(/A \(Brasil\) ⭐8.5/);
  });
});

describe('createGetBracket', () => {
  test('returns help when no data', async () => {
    const repo = makeRepo();
    repo.getBracket.mockResolvedValue(null);
    const uc = createGetBracket({
      statsRepository: repo, getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      competitionId: COMPETITION_ID,
    });
    expect(await uc()).toMatch(/estructura de brackets no está disponible/);
  });

  test('returns knockout stages by default', async () => {
    const repo = makeRepo();
    repo.getBracket.mockResolvedValue({
      competitionId: COMPETITION_ID,
      data: {
        stages: [
          { groups: [{ name: 'A', competitors: [{ name: 'Brasil' }, { name: 'Argentina' }] }] },
          { name: 'Octavos', groups: [] },
        ],
      },
    });
    const uc = createGetBracket({
      statsRepository: repo, getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out).toMatch(/FASE ELIMINATORIA/);
    expect(out).toMatch(/Octavos/);
  });

  test('returns group stage when scope=grupos', async () => {
    const repo = makeRepo();
    repo.getBracket.mockResolvedValue({
      competitionId: COMPETITION_ID,
      data: { stages: [{ groups: [{ name: 'A', competitors: [{ name: 'Brasil' }] }] }] },
    });
    const uc = createGetBracket({
      statsRepository: repo, getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      competitionId: COMPETITION_ID,
    });
    const out = await uc('grupos');
    expect(out).toMatch(/FASE DE GRUPOS/);
    expect(out).toMatch(/Brasil/);
  });
});

describe('createGetHistorial', () => {
  test('returns empty when no history', async () => {
    const repo = makeRepo();
    repo.getCompetitionHistory.mockResolvedValue([]);
    const uc = createGetHistorial({
      statsRepository: repo, getCompetitionName: jest.fn(), getSeasonLabel: jest.fn(),
      competitionId: COMPETITION_ID,
    });
    expect(await uc()).toMatch(/No hay historial/);
  });

  test('lists championships', async () => {
    const repo = makeRepo();
    repo.getCompetitionHistory.mockResolvedValue([
      { competitionId: COMPETITION_ID, seasonNum: 2022, data: { seasonNum: 2022, group: { participants: [{ name: 'Argentina' }, { name: 'Francia' }], games: [{ venue: { name: 'Lusail' } }] } } },
    ]);
    const getSeasonLabel = jest.fn().mockResolvedValue('2022');
    const uc = createGetHistorial({
      statsRepository: repo, getCompetitionName: jest.fn(), getSeasonLabel,
      competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out).toMatch(/HISTORIAL/);
    expect(out).toMatch(/Argentina/);
    expect(out).toMatch(/Francia/);
  });

  test('returns year detail when arg matches year pattern', async () => {
    const repo = makeRepo();
    repo.getCompetitionHistory.mockResolvedValue([
      { competitionId: COMPETITION_ID, seasonNum: 2022, data: { seasonNum: 2022, group: { participants: [{ name: 'Argentina' }, { name: 'Francia' }], games: [{ venue: { name: 'Lusail' } }] } } },
    ]);
    const getSeasonLabel = jest.fn((_, sn) => Promise.resolve(String(sn)));
    const uc = createGetHistorial({
      statsRepository: repo, getCompetitionName: jest.fn(), getSeasonLabel,
      competitionId: COMPETITION_ID,
    });
    const out = await uc('2022');
    expect(out).toMatch(/2022 — Argentina vs Francia/);
    expect(out).toMatch(/Lusail/);
    expect(out).toMatch(/Campeón/);
  });

  test('returns team detail when arg is a team name', async () => {
    const repo = makeRepo();
    repo.getCompetitionHistory.mockResolvedValue([
      { competitionId: COMPETITION_ID, seasonNum: 2022, data: { seasonNum: 2022, group: { participants: [{ name: 'Argentina' }, { name: 'Francia' }] } } },
    ]);
    const getSeasonLabel = jest.fn().mockResolvedValue('2022');
    const uc = createGetHistorial({
      statsRepository: repo, getCompetitionName: jest.fn(), getSeasonLabel,
      competitionId: COMPETITION_ID,
    });
    const out = await uc('brasil');
    expect(out).toMatch(/brasil.*no aparece en el historial/);
  });
});

describe('createGetGoleadores', () => {
  test('returns empty when no stats', async () => {
    const repo = makeRepo();
    repo.getLatestTournamentStats.mockResolvedValue(null);
    const uc = createGetGoleadores({
      statsRepository: repo, getCompetitionName: jest.fn(), competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out.text).toMatch(/No hay ranking de goleadores/);
  });

  test('returns empty when goals category missing', async () => {
    const repo = makeRepo();
    repo.getLatestTournamentStats.mockResolvedValue({
      competitionId: COMPETITION_ID,
      data: { stats: [{ name: 'Asistencias', rows: [] }] },
    });
    const uc = createGetGoleadores({
      statsRepository: repo, getCompetitionName: jest.fn(), competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out.text).toMatch(/No hay ranking de goleadores/);
  });

  test('returns formatted top scorers with photo', async () => {
    const repo = makeRepo();
    repo.getLatestTournamentStats.mockResolvedValue({
      competitionId: COMPETITION_ID,
      data: {
        stats: [{
          name: 'Goles', id: 1,
          rows: [
            { entity: { id: 999, name: 'Messi', shortName: 'M10', competitorName: 'Argentina', value: 8 }, position: 1 },
            { entity: { name: 'Mbappé', competitorName: 'Francia', value: 7 }, position: 2 },
            { entity: { name: 'Alvarez', competitorName: 'Argentina', value: 5 }, position: 3 },
          ],
        }],
      },
    });
    const getAthletePhotoUrl = jest.fn().mockReturnValue('https://img.example/messi.jpg');
    const uc = createGetGoleadores({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      getAthletePhotoUrl,
      competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out.text).toMatch(/🥇/);
    expect(out.text).toMatch(/Messi/);
    expect(out.text).toMatch(/8 goles/);
    expect(out.photoUrl).toBe('https://img.example/messi.jpg');
  });

  test('returns formatted without photo when no athleteId', async () => {
    const repo = makeRepo();
    repo.getLatestTournamentStats.mockResolvedValue({
      competitionId: COMPETITION_ID,
      data: {
        stats: [{
          name: 'Goles',
          rows: [{ entity: { name: 'Mbappé', value: 7 }, position: 1 }],
        }],
      },
    });
    const uc = createGetGoleadores({
      statsRepository: repo,
      getCompetitionName: jest.fn().mockResolvedValue('Copa'),
      getAthletePhotoUrl: jest.fn(),
      competitionId: COMPETITION_ID,
    });
    const out = await uc();
    expect(out.text).toMatch(/Mbappé/);
    expect(out.photoUrl).toBeNull();
  });
});
