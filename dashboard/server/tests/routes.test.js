const mockCosmos = {
  queryAll: jest.fn(),
  queryOne: jest.fn(),
  getById: jest.fn(),
  upsert: jest.fn(),
  health: jest.fn(),
};

const mockImages = {
  getTeamBadgeUrl: jest.fn(() => 'https://img.example.com/badge.png'),
  getAthletePhotoUrl: jest.fn(() => 'https://img.example.com/photo.png'),
  getAthleteThumbUrl: jest.fn(() => 'https://img.example.com/thumb.png'),
  getCountryFlagUrl: jest.fn(() => 'https://img.example.com/flag.png'),
};

const mockScores365 = {
  getTopCompetitors: jest.fn(),
  getGameOverview: jest.fn(),
  getGameStats: jest.fn(),
  getGamePreStats: jest.fn(),
  getGameSuggestions: jest.fn(),
  getCompetitionHistory: jest.fn(),
  getStandings: jest.fn(),
  getTournamentStats: jest.fn(),
  getEntityDescription: jest.fn(),
};

jest.mock('../../../database/cosmos', () => mockCosmos);
jest.mock('../../../services/images', () => mockImages);
jest.mock('../../../services/scores365Service', () => mockScores365);

const request = require('supertest');

let app;
beforeEach(() => {
  jest.clearAllMocks();
  delete require.cache[require.resolve('../index')];
  app = require('../index');
});

describe('Health Check', () => {
  it('devuelve 200 con health info', async () => {
    mockCosmos.getById.mockResolvedValue({ id: '5930' });
    const res = await request(app).get('/api/football/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.cosmos).toBe('connected');
  });

  it('devuelve 503 si cosmos falla', async () => {
    mockCosmos.getById.mockRejectedValue(new Error('timeout'));
    const res = await request(app).get('/api/football/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });
});

describe('GET /api/football/matches', () => {
  it('devuelve 200 con array de partidos', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockCosmos.queryAll.mockResolvedValue([
      { id: 1, competitionId: 5930, statusGroup: 2, startTime: future, homeCompetitor: { id: 1, name: 'Team A' }, awayCompetitor: { id: 2, name: 'Team B' }, stageName: 'Group A', groupNum: 1 },
    ]);
    const res = await request(app).get('/api/football/matches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('devuelve 200 con filtro statusGroup', async () => {
    mockCosmos.queryAll.mockResolvedValue([]);
    const res = await request(app).get('/api/football/matches?statusGroup=4');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/news', () => {
  it('devuelve 200 con array de noticias', async () => {
    mockCosmos.queryAll.mockResolvedValue([
      { id: '1', title: 'Noticia 1', publishDate: '2026-06-10T12:00:00Z', url: 'https://example.com', sourceId: 1, gameId: null },
    ]);
    const res = await request(app).get('/api/football/news');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/standings', () => {
  it('devuelve 200 con array de grupos', async () => {
    mockCosmos.queryAll.mockResolvedValue([
      { name: 'Grupo A', groupNum: 1, rows: [{ competitor: { id: 1, name: 'Team A', imageVersion: 1 }, played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, points: 7, goalDiff: 3 }] },
    ]);
    const res = await request(app).get('/api/football/standings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/football/athletes', () => {
  it('devuelve 200 con array de atletas', async () => {
    mockCosmos.queryAll.mockResolvedValue([{ id: 1, name: 'Jugador 1' }]);
    const res = await request(app).get('/api/football/athletes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('CORS headers', () => {
  it('incluye Access-Control-Allow-Origin para origenes permitidos', async () => {
    mockCosmos.queryAll.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/football/matches')
      .set('Origin', 'https://dashboard.mundialista.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://dashboard.mundialista.com');
  });
});
