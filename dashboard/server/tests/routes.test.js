// Mock del pool de base de datos: los controllers usan pool.query directo,
// no scores365Service, así que hay que mockear database/connection.
// mockPool.query detecta queries a `active_competitions` y devuelve un seed
// con Mundial + Liga Promerica para que `resolveCompetition` valide OK.

const mockQuery = jest.fn();
jest.mock('../../../database/connection', () => ({
  pool: { query: mockQuery },
  testConnection: jest.fn().mockResolvedValue(true),
}));

// scores365Service/images siguen mockeados por si algún controller los reach.
const mockScores365 = {
  getCompetition: jest.fn(),
  getTopCompetitors: jest.fn(),
  getGamesAllScores: jest.fn(),
  getGamesCurrent: jest.fn(),
  getGamesFeatured: jest.fn(),
  getGameOverview: jest.fn(),
  getGameStats: jest.fn(),
  getGameH2H: jest.fn(),
  getGamePreStats: jest.fn(),
  getGameSuggestions: jest.fn(),
  getCompetitionHistory: jest.fn(),
  getStandings: jest.fn(),
  getTournamentStats: jest.fn(),
  getTeamOfWeek: jest.fn(),
  getBrackets: jest.fn(),
  getEntityDescription: jest.fn(),
  getTrends: jest.fn(),
  getNews: jest.fn(),
  getAthlete: jest.fn(),
};

const mockImages = {
  getTeamBadgeUrl: jest.fn(() => 'https://img.example.com/badge.png'),
  getAthletePhotoUrl: jest.fn(() => 'https://img.example.com/photo.png'),
  getAthleteThumbUrl: jest.fn(() => 'https://img.example.com/thumb.png'),
  getCountryFlagUrl: jest.fn(() => 'https://img.example.com/flag.png'),
};

jest.mock('../../../services/scores365Service', () => mockScores365);
jest.mock('../../../services/images', () => mockImages);

const request = require('supertest');

// Seed que match la migración 008_active_competitions.sql
const ACTIVE_COMPETITIONS_SEED = [
  {
    id: 5930,
    display_name: 'Copa Mundial de la FIFA 2026',
    short_name: 'Mundial 2026',
    country_id: 54,
    country_name: 'Internacional',
    season_num: 25,
    season_label: '2026',
    start_date: '2026-06-01',
    end_date: '2026-08-15',
    is_active: true,
    is_featured: true,
    display_order: 10,
    has_brackets: true,
    has_groups: true,
    has_history: true,
    config: null,
  },
  {
    id: 5056,
    display_name: 'Liga Promerica',
    short_name: 'Liga Promerica',
    country_id: 153,
    country_name: 'Costa Rica',
    season_num: 146,
    season_label: '2026/2027',
    start_date: '2026-07-19',
    end_date: '2026-12-20',
    is_active: true,
    is_featured: true,
    display_order: 20,
    has_brackets: false,
    has_groups: false,
    has_history: true,
    config: null,
  },
];

// mockQuery intercepta queries a `active_competitions` y devuelve el seed.
// Para cualquier otra query, devuelve vacío por defecto.
function setupSmartMock() {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql, params) => {
    if (typeof sql === 'string' && sql.includes('FROM active_competitions')) {
      return Promise.resolve({ rows: ACTIVE_COMPETITIONS_SEED });
    }
    return Promise.resolve({ rows: [] });
  });
}

let app;
beforeEach(() => {
  jest.clearAllMocks();
  setupSmartMock();
  // Reset cache between tests so they don't leak active_competitions state.
  try {
    const { invalidateCompetitionCache } = require('../utils/competition');
    invalidateCompetitionCache();
  } catch (_) { /* first load */ }
  delete require.cache[require.resolve('../index')];
  app = require('../index');
});

describe('Health Check', () => {
  it('devuelve 200 con health info', async () => {
    const res = await request(app).get('/api/football/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.datasource).toBe('365scores');
  });
});

describe('GET /api/football/matches', () => {
  it('devuelve 200 con array de partidos (comp default = Mundial 2026)', async () => {
    // Sobreescribe el smart mock para este test.
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED }) // active_competitions
      .mockResolvedValueOnce({
        rows: [{ data: { id: 1, competitionId: 5930, statusGroup: 2, stageName: 'Group A' } }],
      });
    const res = await request(app).get('/api/football/matches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('devuelve 200 con filtro statusGroup', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/football/matches?statusGroup=4');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('acepta ?competitionId=5056 (Liga Promerica)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({
        rows: [{ data: { id: 999, competitionId: 5056, statusGroup: 2 } }],
      });
    const res = await request(app).get('/api/football/matches?competitionId=5056');
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(999);
  });

  it('devuelve 404 si competitionId no está activo', async () => {
    mockQuery.mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED });
    const res = await request(app).get('/api/football/matches?competitionId=999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch('no disponible');
    expect(Array.isArray(res.body.available)).toBe(true);
  });

  it('modo ?all=true devuelve partidos de todas las competiciones activas', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({
        rows: [
          { data: { id: 1, competitionId: 5930, statusGroup: 2 } },
          { data: { id: 2, competitionId: 5056, statusGroup: 2 } },
        ],
      });
    const res = await request(app).get('/api/football/matches?all=true');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('GET /api/football/news', () => {
  it('devuelve 200 con array de noticias', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({
        rows: [{ data: { id: '1', title: 'Noticia 1', publishDate: '2026-06-10T12:00:00Z', url: 'https://example.com', sourceId: 1, gameId: null } }],
      });
    const res = await request(app).get('/api/football/news');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/standings', () => {
  it('devuelve 200 con array de grupos', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({
        rows: [{ data: { groupNum: 1, rows: [{ competitor: { id: 1, name: 'Team A' }, points: 7 }] } }],
      });
    const res = await request(app).get('/api/football/standings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/athletes', () => {
  it('devuelve 200 con array de atletas', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ data: { id: 1, name: 'Jugador 1' } }],
    });
    const res = await request(app).get('/api/football/athletes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Multi-comp endpoints', () => {
  it('GET /competitions devuelve las 2 activas', async () => {
    mockQuery.mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED });
    const res = await request(app).get('/api/football/competitions');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].id).toBe(5930);
    expect(res.body[1].id).toBe(5056);
  });

  it('GET /competitions/featured devuelve solo featured=true', async () => {
    mockQuery.mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED });
    const res = await request(app).get('/api/football/competitions/featured');
    expect(res.status).toBe(200);
    expect(res.body.every(c => c.isFeatured)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it('GET /competitions/5930 devuelve detalle con seasons', async () => {
    mockQuery.mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED });
    mockQuery.mockResolvedValueOnce({
      rows: [{ data: { competitions: [{ id: 5930, name: 'Mundial', seasons: [{ num: 25, name: '2026' }] }] } }],
    });
    const res = await request(app).get('/api/football/competitions/5930');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5930);
    expect(res.body.hasBrackets).toBe(true);
    expect(res.body.seasons.length).toBe(1);
  });

  it('GET /competitions/999999 devuelve 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED });
    const res = await request(app).get('/api/football/competitions/999999');
    expect(res.status).toBe(404);
  });
});

describe('CORS headers', () => {
  it('incluye Access-Control-Allow-Origin para origenes permitidos', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/football/matches')
      .set('Origin', 'https://scorehub-pocho.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://scorehub-pocho.vercel.app');
  });

  it('rechaza origenes no permitidos', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: ACTIVE_COMPETITIONS_SEED })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/football/matches')
      .set('Origin', 'https://evil.com');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.com');
  });
});

describe('Validation errors', () => {
  it('devuelve 400 para history con seasonNum inválido', async () => {
    const res = await request(app).get('/api/football/history/abc');
    expect(res.status).toBe(400);
  });
});
