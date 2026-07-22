// Mock del pool de base de datos: los controllers usan pool.query directo,
// no scores365Service, así que hay que mockear database/connection.
// mockPool.query es un jest.fn() que cada test configura con mockResolvedValueOnce.
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

let app;
beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockReset();
  // Default: queries devuelven vacío.
  mockQuery.mockResolvedValue({ rows: [] });
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
  it('devuelve 200 con array de partidos', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ data: { id: 1, competitionId: 5930, statusGroup: 2, stageName: 'Group A' } }],
    });
    const res = await request(app).get('/api/football/matches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('devuelve 200 con filtro statusGroup', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/football/matches?statusGroup=4');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/news', () => {
  it('devuelve 200 con array de noticias', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ data: { id: '1', title: 'Noticia 1', publishDate: '2026-06-10T12:00:00Z', url: 'https://example.com', sourceId: 1, gameId: null } }],
    });
    const res = await request(app).get('/api/football/news');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/standings', () => {
  it('devuelve 200 con array de grupos', async () => {
    mockQuery.mockResolvedValueOnce({
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

describe('CORS headers', () => {
  it('incluye Access-Control-Allow-Origin para origenes permitidos', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/football/matches')
      .set('Origin', 'https://scorehub-pocho.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://scorehub-pocho.vercel.app');
  });

  it('rechaza origenes no permitidos', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
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
