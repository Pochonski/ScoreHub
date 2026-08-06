/**
 * tests/controllers.test.js — Fase 4 (mejora de tests)
 *
 * Tests de ruta (supertest) para los controllers que no tenían cobertura.
 * Patrón de routes.test.js: se mockea database/connection (pool + pgQueryRetry
 * + withTransaction → mockQuery), scores365Service e images. db.js corre real y
 * enruta al mock (isEnabled()=false en test → queryViaPg → pgQueryRetry).
 *
 * `setTableResponses({ tabla: filas })` controla qué devuelve cada SELECT.
 */

const mockQuery = jest.fn();
jest.mock('../../../database/connection', () => ({
  pool: { query: mockQuery },
  testConnection: jest.fn().mockResolvedValue(true),
  pgQueryRetry: (...a) => mockQuery(...a),
  withTransaction: (fn) => fn({ query: mockQuery }),
}));

const mockScores365 = {
  getTournamentStats: jest.fn(),
  getTrendDetails: jest.fn(),
  getTransfers: jest.fn(),
  getGameSuggestions: jest.fn(),
  getCompetition: jest.fn(),
  getCompetitor: jest.fn(),
  getCompetitorRecentForm: jest.fn(),
  getFixtures: jest.fn(),
  getGamesCurrent: jest.fn(),
  getCompetitionHistory: jest.fn(),
  getTrends: jest.fn(),
};
jest.mock('../../../services/scores365Service', () => mockScores365);
jest.mock('../../../services/images', () => ({
  getTeamBadgeUrl: jest.fn(() => 'badge'),
  getAthletePhotoUrl: jest.fn(() => 'photo'),
  getAthleteThumbUrl: jest.fn(() => 'thumb'),
  getCountryFlagUrl: jest.fn(() => 'flag'),
}));

const request = require('supertest');

const ACTIVE_COMPETITIONS_SEED = [
  {
    id: 5930, display_name: 'Copa Mundial 2026', short_name: 'Mundial 2026',
    country_id: 54, country_name: 'Internacional', season_num: 25, season_label: '2026',
    start_date: '2026-06-01', end_date: '2026-08-15', is_active: true, is_featured: true,
    display_order: 10, has_brackets: true, has_groups: true, has_history: true, config: null,
  },
];

// Respuestas por tabla, configurables por test. Cae a [] por defecto.
let tableResponses = {};
function setTableResponses(map) { tableResponses = map; }

function installMock() {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql) => {
    const s = String(sql);
    if (/FROM active_competitions/i.test(s)) return Promise.resolve({ rows: ACTIVE_COMPETITIONS_SEED });
    if (/\bNOW\(\)/i.test(s)) return Promise.resolve({ rows: [{ now: new Date().toISOString() }] });
    for (const [table, rows] of Object.entries(tableResponses)) {
      if (new RegExp(`FROM ${table}\\b`, 'i').test(s)) return Promise.resolve({ rows });
    }
    return Promise.resolve({ rows: [] });
  });
}

let app;
beforeEach(() => {
  jest.clearAllMocks();
  setTableResponses({});
  installMock();
  try { require('../utils/competition').invalidateCompetitionCache(); } catch { /* first load */ }
  delete require.cache[require.resolve('../index')];
  app = require('../index');
});

describe('statsController — /stats/*', () => {
  test('GET /stats/scorers → 200 con goleadores mapeados', async () => {
    setTableResponses({
      tournament_stats: [{ data: { stats: { athletesStats: [
        { id: 1, name: 'Goles', rows: [
          { entity: { id: 900, name: 'Goleador', competitorId: 100 }, stats: [{ typeId: 1, value: 9 }] },
        ] },
      ] } } }],
      competitors: [{ id: 100, name: 'Equipo A', data: { name: 'Equipo A' } }],
    });
    const res = await request(app).get('/api/football/stats/scorers?competitionId=5930');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ athleteId: 900, name: 'Goleador', teamName: 'Equipo A', value: 9 });
  });

  test('GET /stats/assists → 200 (lee categoría 3 de tournament_stats)', async () => {
    setTableResponses({
      tournament_stats: [{ data: { stats: { athletesStats: [
        { id: 3, name: 'Asistencias', rows: [
          { entity: { id: 901, name: 'Asistente', competitorId: 100 }, stats: [{ typeId: 2, value: 7 }] },
        ] },
      ] } } }],
      competitors: [{ id: 100, name: 'Equipo A', data: { name: 'Equipo A' } }],
    });
    const res = await request(app).get('/api/football/stats/assists?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ athleteId: 901, value: 7 });
  });

  test('GET /stats/team-of-week → 200 con formación y jugadores', async () => {
    setTableResponses({
      team_of_week: [{ data: { teamOfTheWeek: { lineup: {
        formation: '4-3-3',
        members: [{ name: 'Portero', position: { name: 'GK' }, ranking: 8.5, athleteId: 1 }],
      } } } }],
    });
    const res = await request(app).get('/api/football/stats/team-of-week?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ formation: '4-3-3' });
    expect(res.body.players[0]).toMatchObject({ name: 'Portero', position: 'GK', rating: 8.5 });
  });

  test('GET /stats/team-of-week sin datos → 200 con null', async () => {
    setTableResponses({ team_of_week: [] });
    const res = await request(app).get('/api/football/stats/team-of-week?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('GET /stats/scorers con competición inactiva → 404', async () => {
    const res = await request(app).get('/api/football/stats/scorers?competitionId=999999');
    expect(res.status).toBe(404);
  });
});

describe('trendController — /trends', () => {
  test('GET /trends → 200, dedup por betCTA|lineTypeId, max 10', async () => {
    setTableResponses({
      trends: [
        { data: { betCTA: 'Over 2.5', lineTypeId: 3, trendText: 'a' } },
        { data: { betCTA: 'Over 2.5', lineTypeId: 3, trendText: 'dup' } }, // duplicado
        { data: { betCTA: 'BTTS', lineTypeId: 12, trendText: 'b' } },
      ],
    });
    const res = await request(app).get('/api/football/trends?competitionId=5930');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2); // 3 - 1 duplicado
  });
});

describe('trendDetailController — /trends/details', () => {
  test('trendId no numérico → 400', async () => {
    const res = await request(app).get('/api/football/trends/details?trendId=abc');
    expect(res.status).toBe(400);
  });

  test('hit en DB → 200 con trend + games', async () => {
    setTableResponses({
      trend_details: [{ data: {
        trend: { id: 55, text: 'Tendencia' },
        games: [{ game: { id: 1 }, outcome: 'W', competitionId: 5930 }],
      } }],
    });
    const res = await request(app).get('/api/football/trends/details?trendId=55');
    expect(res.status).toBe(200);
    expect(res.body.trend).toMatchObject({ id: 55 });
    expect(res.body.games[0]).toMatchObject({ outcome: 'W', competitionId: 5930 });
  });

  test('cache miss → hydrata desde upstream', async () => {
    setTableResponses({ trend_details: [] });
    mockScores365.getTrendDetails.mockResolvedValueOnce({ trend: { id: 77 }, games: [] });
    const res = await request(app).get('/api/football/trends/details?trendId=77');
    expect(res.status).toBe(200);
    expect(res.body.trend).toMatchObject({ id: 77 });
    expect(mockScores365.getTrendDetails).toHaveBeenCalledWith(77);
  });
});

describe('infoController — /tournament-info', () => {
  test('sin detalle en DB → 200 con fallback "Sin detalle disponible"', async () => {
    setTableResponses({ competitions: [] });
    const res = await request(app).get('/api/football/tournament-info?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5930, format: 'Sin detalle disponible' });
  });

  test('con detalle en DB → 200 con info de la competición', async () => {
    setTableResponses({
      competitions: [{ data: { competitions: [{ id: 5930, name: 'FIFA World Cup', currentSeasonNum: 25 }] } }],
    });
    const res = await request(app).get('/api/football/tournament-info?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5930, name: 'FIFA World Cup' });
  });
});

describe('transfersController — /competitions/:id/transfers', () => {
  test('id no numérico → 400', async () => {
    const res = await request(app).get('/api/football/competitions/abc/transfers?competitionId=5930');
    expect(res.status).toBe(400);
  });

  test('hit en DB → 200 con transfers mapeados', async () => {
    setTableResponses({
      competition_transfers: [{
        transfer_id: 1, athlete_id: 900, athlete_name: 'Jugador', athlete_short_name: 'J',
        origin_id: 10, origin_name: 'Club A', target_id: 20, target_name: 'Club B', time: 1720000000000,
      }],
    });
    const res = await request(app).get('/api/football/competitions/5930/transfers?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: 1, athleteId: 900, athleteName: 'Jugador' });
  });
});

describe('teamController — /teams', () => {
  test('GET /teams → 200 con equipos de la junction table', async () => {
    setTableResponses({
      competition_competitors: [{ competitor_id: 100 }],
      competitors: [{ id: 100, name: 'Equipo A', data: { shortName: 'EqA' } }],
    });
    const res = await request(app).get('/api/football/teams?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: 100, name: 'Equipo A', shortName: 'EqA' });
  });
});

describe('teamEnhancementsController — /teams/:id/recent-form', () => {
  test('id no numérico → 400', async () => {
    const res = await request(app).get('/api/football/teams/abc/recent-form');
    expect(res.status).toBe(400);
  });

  test('cache miss → hydrata desde upstream (getCompetitorRecentForm)', async () => {
    setTableResponses({ team_recent_form: [] });
    mockScores365.getCompetitorRecentForm.mockResolvedValueOnce({ games: [{ gameId: 1, result: 'W' }] });
    const res = await request(app).get('/api/football/teams/100/recent-form?numOfGames=5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ gameId: 1, result: 'W' }]);
    expect(mockScores365.getCompetitorRecentForm).toHaveBeenCalledWith(100, 5);
  });
});

describe('historyController — /history', () => {
  test('sin historia en DB ni competición → 200 con []', async () => {
    setTableResponses({ competition_history: [], competitions: [] });
    const res = await request(app).get('/api/football/history?competitionId=5930');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
