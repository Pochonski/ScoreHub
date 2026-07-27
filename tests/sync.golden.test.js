/**
 * Golden-master de `syncService` — jobs de ETL (Fase 7, Fase 0).
 *
 * Congela las ESCRITURAS que cada job emite a la base (tabla + SQL + params),
 * con la fuente 365scores mockeada con payloads canónicos. Todos los writes
 * pasan por `pool.query`/`db.*` (ver tests/helpers/dbCapture.js).
 *
 * El tiempo se congela porque las filas llevan `updated_at`/`last_seen_at` con
 * `new Date().toISOString()`.
 */

process.env.NODE_ENV = 'test';

jest.mock('../database/connection', () => {
  const c = require('./helpers/dbCapture');
  return { pool: c.pool, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../database/db', () => require('./helpers/dbCapture').db);
jest.mock('../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../services/scores365Service', () => ({
  getStandings: jest.fn(),
  getGamesAllScores: jest.fn(),
  getNews: jest.fn(),
}));
jest.mock('../services/syncCompetitions', () => {
  const comps = [{ id: 5930, seasonNum: 25, startDate: '20260601', endDate: '20260715' }];
  return {
    getActiveCompetitions: jest.fn(async () => comps),
    forEachActive: jest.fn(async (fn) => {
      for (const c of comps) await fn(c);
      return { total: comps.length, ok: comps.length, failed: 0, errors: [] };
    }),
    filterGamesByActiveComps: (g) => g,
  };
});

const api = require('../services/scores365Service');
const { reset, getWrites } = require('./helpers/dbCapture');
const sync = require('../services/syncService');

beforeAll(() => { jest.useFakeTimers({ now: new Date('2026-07-27T12:00:00.000Z') }); });
afterAll(() => { jest.useRealTimers(); });
beforeEach(() => reset());

describe('syncService — golden-master de escrituras', () => {
  test('syncStandings escribe standings + junction competition_competitors', async () => {
    api.getStandings.mockImplementation(async (compId, type, season, opts) => {
      if (opts?.withSeasonsFilter) return { seasonsFilter: { seasons: [{ num: 25 }] }, standings: [] };
      if (type === 1) {
        return { standings: [{ num: 1, rows: [{ competitor: { id: 100 } }, { competitor: { id: 101 } }] }] };
      }
      return null; // type 2 no disponible para el Mundial
    });
    await sync.syncStandings();
    expect(getWrites()).toMatchSnapshot();
  });

  test('syncGames escribe games (+ junction desde games)', async () => {
    api.getGamesAllScores.mockResolvedValue({
      games: [
        {
          id: 4749268, competitionId: 5930, statusGroup: 2, statusText: 'Scheduled',
          startTime: '2026-06-10T18:00:00Z', seasonNum: 25, stage: 'Group A',
          homeCompetitor: { id: 100, score: -1 }, awayCompetitor: { id: 101, score: -1 },
        },
        { id: 999, competitionId: 1234, homeCompetitor: { id: 5 }, awayCompetitor: { id: 6 } }, // otra comp → filtrada
      ],
    });
    await sync.syncGames();
    expect(getWrites()).toMatchSnapshot();
  });

  test('syncNews escribe news', async () => {
    api.getNews.mockResolvedValue({
      news: [
        { id: 'n1', gameId: 4749268, publishDate: '2026-06-09T10:00:00Z', title: 'Noticia 1' },
        { id: 'n2', gameId: null, publishDate: '2026-06-09T12:00:00Z', title: 'Noticia 2' },
      ],
    });
    await sync.syncNews();
    expect(getWrites()).toMatchSnapshot();
  });

  test('syncNews sin items no escribe nada', async () => {
    api.getNews.mockResolvedValue({ news: [] });
    await sync.syncNews();
    expect(getWrites()).toEqual([]);
  });
});
