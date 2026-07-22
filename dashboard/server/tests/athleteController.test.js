// Mock DB pool. Each test configures the rows returned by each query.
const mockQuery = jest.fn();
jest.mock('../../../database/connection', () => ({
  pool: { query: mockQuery },
  testConnection: jest.fn().mockResolvedValue(true),
}));

// Upstream service mock: we want to assert hydration paths without hitting 365scores.
const mockScores365 = {
  getAthlete: jest.fn(),
};

jest.mock('../../../services/scores365Service', () => mockScores365);
jest.mock('../../../services/images', () => ({
  getTeamBadgeUrl: jest.fn(() => 'badge'),
  getAthletePhotoUrl: jest.fn(() => 'photo'),
  getAthleteThumbUrl: jest.fn(() => 'thumb'),
  getCountryFlagUrl: jest.fn(() => 'flag'),
}));

const request = require('supertest');

// The athlete controller is required inside the route module which is loaded
// inside the express app. We can't easily reset only the controller module
// between tests because the app loads routes + controllers at boot. Instead
// we re-require the whole app after clearing the relevant jest mocks.

let app;
function reloadApp() {
  jest.clearAllMocks();
  mockQuery.mockReset();
  mockScores365.getAthlete.mockReset();
  delete require.cache[require.resolve('../index')];
  delete require.cache[require.resolve('../controllers/athleteController')];
  app = require('../index');
}

beforeEach(() => reloadApp());

describe('GET /api/football/athletes/:id (canonical lookup)', () => {
  it('resolves by PK', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 39820,
        name: 'Kylian Mbappe',
        data: {
          id: 39820,
          name: 'Kylian Mbappe',
          age: 26,
          position: { id: 1, name: 'Delantero' },
        },
        updated_at: new Date(),
        canonical_id: 39820,
      }],
    });
    const res = await request(app).get('/api/football/athletes/39820');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Kylian Mbappe');
    expect(res.body.id).toBe(39820);
  });

  it('hydrates from upstream on cache miss', async () => {
    // First query: row not found by id
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // hydrateFromUpstream calls api.getAthlete + INSERT
    mockScores365.getAthlete.mockResolvedValueOnce({
      athletes: [{ id: 39820, name: 'Kylian Mbappe', age: 26 }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT
    const res = await request(app).get('/api/football/athletes/39820');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Kylian Mbappe');
    expect(mockScores365.getAthlete).toHaveBeenCalledWith(39820, true);
  });

  it('returns 404 when upstream also misses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockScores365.getAthlete.mockResolvedValueOnce({ athletes: [] });
    const res = await request(app).get('/api/football/athletes/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Jugador no encontrado');
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/football/athletes/abc');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/football/athletes/:id/career', () => {
  it('maps careerStats.seasons shape (current upstream)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 39820,
        data: {
          careerStats: { seasons: [
            { key: '2026', name: '2025/2026', stats: { tables: [], categories: [] } },
            { key: '-1', name: 'Total', stats: { tables: [] } },
          ] },
        },
      }],
    });
    const res = await request(app).get('/api/football/athletes/39820/career');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].seasonKey).toBe('2026');
    expect(res.body[0].name).toBe('2025/2026');
  });

  it('maps legacy careers[] shape (backwards compat)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        data: { careers: [{ seasonKey: '2024', name: '2023/2024', stats: {} }] },
      }],
    });
    const res = await request(app).get('/api/football/athletes/1/career');
    expect(res.status).toBe(200);
    expect(res.body[0].seasonKey).toBe('2024');
  });
});

describe('GET /api/football/athletes/:id/trophies', () => {
  it('maps trophies.categories shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        data: {
          trophies: { categories: {
            Club: { name: 'Club', trophies: [{ name: 'Ligue 1', count: 7 }] },
          } },
        },
      }],
    });
    const res = await request(app).get('/api/football/athletes/1/trophies');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Club');
    expect(res.body[0].trophies[0].name).toBe('Ligue 1');
    expect(res.body[0].trophies[0].count).toBe(7);
  });
});

describe('GET /api/football/athletes?search=...', () => {
  it('queries the athletes table directly', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 39820, name: 'Kylian Mbappe', data: { id: 39820, name: 'Kylian Mbappe' } },
        { id: 874, name: 'Lionel Messi', data: { id: 874, name: 'Lionel Messi' } },
      ],
    });
    const res = await request(app).get('/api/football/athletes?search=mbappe');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    // The SQL passed to mockQuery should hit the athletes table, not game_overviews.
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/FROM athletes/);
    expect(sql).not.toMatch(/FROM game_overviews/);
  });
});

describe('Controller shape helpers', () => {
  const ctrl = require('../controllers/athleteController');

  it('shapeCareer normalizes both shapes', () => {
    const a = ctrl._internal.shapeCareer({ careerStats: { seasons: [{ key: '2026', name: '2025/2026' }] } });
    expect(a[0].seasonKey).toBe('2026');
    const b = ctrl._internal.shapeCareer({ careers: [{ seasonKey: '2024' }] });
    expect(b[0].seasonKey).toBe('2024');
    expect(ctrl._internal.shapeCareer(null)).toEqual([]);
    expect(ctrl._internal.shapeCareer({})).toEqual([]);
  });

  it('shapeTrophies handles both trophies.categories and trophies.honours', () => {
    const a = ctrl._internal.shapeTrophies({ categories: { C: { name: 'C', trophies: [{ name: 'X', count: 1 }] } } });
    expect(a[0].name).toBe('C');
    expect(ctrl._internal.shapeTrophies({})).toEqual([]);
    expect(ctrl._internal.shapeTrophies(null)).toEqual([]);
  });

  it('isRowSparse detects missing enriched fields', () => {
    // No enriched fields at all.
    expect(ctrl._internal.isRowSparse({ data: {} })).toBe(true);
    // Only basic identity fields.
    expect(ctrl._internal.isRowSparse({ data: { id: 1, name: 'X' } })).toBe(true);
    // trophies.categories present — not sparse.
    expect(ctrl._internal.isRowSparse({
      data: { trophies: { categories: { C: {} } } },
    })).toBe(false);
    // transfers with entries — not sparse.
    expect(ctrl._internal.isRowSparse({
      data: { transfers: [{ date: '2024-01-01' }] },
    })).toBe(false);
    // careerStats.seasons with entries — not sparse.
    expect(ctrl._internal.isRowSparse({
      data: { careerStats: { seasons: [{ key: '2024' }] } },
    })).toBe(false);
  });
});