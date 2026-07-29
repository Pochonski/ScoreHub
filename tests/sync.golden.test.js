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
  return { pool: c.pool, withTransaction: c.withTransaction, pgQueryRetry: c.pgQueryRetry, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../database/db', () => require('./helpers/dbCapture').db);
jest.mock('../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../services/scores365Service', () => ({
  getStandings: jest.fn(),
  getGamesAllScores: jest.fn(),
  getGamesCurrent: jest.fn(),
  getGamesResults: jest.fn(),
  getFixtures: jest.fn(),
  getNews: jest.fn(),
  getTrends: jest.fn(),
  getBrackets: jest.fn(),
  getGameSuggestions: jest.fn(),
  getTournamentStats: jest.fn(),
  getTeamOfWeek: jest.fn(),
  getCompetitionHistory: jest.fn(),
  getOutrights: jest.fn(),
  getPredictions: jest.fn(),
  getTopCompetitors: jest.fn(),
  getOddsLines: jest.fn(),
  getGameStats: jest.fn(),
  getGameOverview: jest.fn(),
  getGameH2H: jest.fn(),
  getGameLineups: jest.fn(),
  getGamePreStats: jest.fn(),
  getGameNews: jest.fn(),
  getTransfers: jest.fn(),
  getAthlete: jest.fn(),
  getCompetition: jest.fn(),
}));
jest.mock('../services/syncCompetitions', () => {
  const comps = [{ id: 5930, seasonNum: 25, startDate: '20260601', endDate: '20260715', hasBrackets: true, hasHistory: true }];
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
const { reset, getWrites, setExecResult, setExecResults } = require('./helpers/dbCapture');
const sync = require('../src/application/sync/syncService');

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

  // Regresión del bug: withTransaction no estaba importado en syncService, así
  // que este job (y transfers/suggestions/catalog/athletes) lanzaba
  // ReferenceError silencioso y NO escribía. Ahora sí debe escribir (DELETE +
  // INSERT dentro de la transacción).
  test('syncTrends escribe trends de forma atómica (DELETE + INSERT en tx)', async () => {
    api.getTrends.mockResolvedValue({
      trends: [
        { gameId: 4749268, lineTypeId: 3, name: 'Over 2.5' },
        { homeTeamGameId: 4749269, lineTypeId: 5, name: 'BTTS' },
      ],
    });
    await sync.syncTrends();
    const writes = getWrites();
    expect(writes.map((w) => w.via)).toEqual(['tx', 'tx']); // DELETE + INSERT en transacción
    expect(writes[0].sql).toMatch(/^DELETE FROM trends/);
    expect(writes[1].sql).toMatch(/^INSERT INTO trends/);
  });

  test('syncBrackets escribe brackets (upsertMany)', async () => {
    api.getBrackets.mockResolvedValue({ stages: [{ name: 'Octavos' }] });
    await sync.syncBrackets();
    const writes = getWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toMatch(/^INSERT INTO brackets/);
    expect(writes[0].params[0]).toBe(5930);
  });

  // Otro job de transacción que estaba fallando silenciosamente (withTransaction).
  test('syncSuggestions escribe game_suggestions atómico (DELETE + INSERT)', async () => {
    api.getGameSuggestions.mockResolvedValue({
      suggestedGames: [{ id: 111, rank: 1 }, { id: 222, rank: 2 }],
    });
    await sync.syncSuggestions();
    const writes = getWrites();
    expect(writes.map((w) => w.via)).toEqual(['tx', 'tx']);
    expect(writes[0].sql).toMatch(/^DELETE FROM game_suggestions/);
    expect(writes[1].sql).toMatch(/^INSERT INTO game_suggestions/);
  });

  // Familia games (no filtran por comp; upsertGames + junction).
  const GAME = { id: 4749268, competitionId: 5930, seasonNum: 25, homeCompetitor: { id: 100 }, awayCompetitor: { id: 101 } };
  test.each([
    ['syncLiveGames', 'getGamesCurrent'],
    ['syncGamesResults', 'getGamesResults'],
    ['syncFixtures', 'getFixtures'],
  ])('%s → games + junction', async (job, apiMethod) => {
    api[apiMethod].mockResolvedValue({ games: [GAME] });
    await sync[job]();
    const tables = getWrites().map((w) => w.sql.match(/(?:INTO|FROM) (\w+)/)[1]);
    expect(tables).toEqual(['games', 'competition_competitors']);
  });

  test.each([
    ['syncTournamentStats', 'getTournamentStats', 'tournament_stats'],
    ['syncTeamOfWeek', 'getTeamOfWeek', 'team_of_week'],
    ['syncOutrights', 'getOutrights', 'odds_outrights'],
  ])('%s → upsertMany(%s)', async (job, apiMethod, table) => {
    api[apiMethod].mockResolvedValue({ some: 'data' });
    await sync[job]();
    const writes = getWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toMatch(new RegExp(`^INSERT INTO ${table}`));
  });

  test('syncCompetitionHistory → competition_history (si hasHistory)', async () => {
    api.getCompetitionHistory.mockResolvedValue({
      docs: [{ seasonNum: 22, entityId: 5, title: 'Campeón', values: { x: 1 } }],
    });
    await sync.syncCompetitionHistory();
    const writes = getWrites();
    expect(writes.some((w) => /INSERT INTO competition_history/.test(w.sql))).toBe(true);
  });

  test('syncPredictions → predictions', async () => {
    // 365scores devuelve predicciones dentro de cada game:
    //   data.games[i].promotedPredictions.predictions[]
    api.getPredictions.mockResolvedValue({
      games: [{
        id: 4749268,
        promotedPredictions: {
          predictions: [{ gameId: 4749268, title: '¿Quién gana?', options: [] }],
        },
      }],
    });
    setExecResult([{ id: 4749268 }]); // game existe en nuestra DB
    await sync.syncPredictions();
    expect(getWrites().some((w) => /INSERT INTO predictions/.test(w.sql))).toBe(true);
  });

  test('syncPredictions → filtra games que no están en nuestra DB', async () => {
    api.getPredictions.mockResolvedValue({
      games: [{
        id: 9999999,
        promotedPredictions: {
          predictions: [{ gameId: 9999999 }],
        },
      }],
    });
    setExecResult([]); // game NO existe en nuestra DB
    await sync.syncPredictions();
    expect(getWrites().some((w) => /INSERT INTO predictions/.test(w.sql))).toBe(false);
  });

  test('syncCountries → countries', async () => {
    api.getTopCompetitors.mockResolvedValue({ countries: [{ id: 54, name: 'Internacional' }] });
    await sync.syncCountries();
    expect(getWrites()[0].sql).toMatch(/^INSERT INTO countries/);
  });

  test('syncOdds → itera games (execAdvanced) y escribe odds_lines', async () => {
    setExecResult([{ id: 4749268 }]);
    api.getOddsLines.mockResolvedValue({ lines: [{ id: 1 }] });
    await sync.syncOdds();
    expect(getWrites().some((w) => /INSERT INTO odds_lines/.test(w.sql))).toBe(true);
  });

  test('syncLiveStats → itera games en vivo y escribe game_stats', async () => {
    setExecResult([{ id: 4749268 }]);
    api.getGameStats.mockResolvedValue({ lastUpdateId: 7, stats: [] });
    await sync.syncLiveStats();
    expect(getWrites().some((w) => /INSERT INTO game_stats/.test(w.sql))).toBe(true);
  });

  test('syncVenues → extrae venues de game_overviews y escribe venues', async () => {
    setExecResult([{ data: { game: { venue: { id: 9, name: 'MetLife Stadium', city: 'NJ' } } } }]);
    await sync.syncVenues();
    expect(getWrites().some((w) => /INSERT INTO venues/.test(w.sql))).toBe(true);
  });

  test('syncGameDetails → escribe las tablas de detalle por game', async () => {
    setExecResult([{ id: 4749268 }]);
    api.getGameOverview.mockResolvedValue({ game: {} });
    api.getGameH2H.mockResolvedValue({ h2h: [] });
    api.getGamePreStats.mockResolvedValue({ stats: [] });
    api.getGameLineups.mockResolvedValue({ lineups: [] });
    api.getGameStats.mockResolvedValue({ stats: [] });
    api.getGameNews.mockResolvedValue({ news: [] });
    await sync.syncGameDetails();
    const tables = getWrites().map((w) => w.sql.match(/INTO (\w+)/)[1]);
    expect(tables).toEqual(expect.arrayContaining(['game_overviews', 'game_h2h', 'game_pre_stats', 'game_stats']));
  });

  // Job de transacción que estaba fallando silenciosamente (withTransaction).
  test('syncTransfers → refs de athletes/competitors + competition_transfers (atómico)', async () => {
    api.getTransfers.mockResolvedValue({
      transfers: [{ id: 1, athleteId: 100, origin: 4, target: 7, isArrival: true }],
      athletes: [{ id: 100, name: 'Mbappé' }],
      competitors: [{ id: 4, name: 'PSG' }, { id: 7, name: 'Madrid' }],
    });
    await sync.syncTransfers();
    const writes = getWrites();
    expect(writes.every((w) => w.via === 'tx')).toBe(true);
    expect(writes.some((w) => /INTO athletes/.test(w.sql))).toBe(true);
    expect(writes.some((w) => /INTO competitors/.test(w.sql))).toBe(true);
    expect(writes.some((w) => /DELETE FROM competition_transfers/.test(w.sql))).toBe(true);
    expect(writes.some((w) => /INSERT INTO competition_transfers/.test(w.sql))).toBe(true);
  });

  // Job de transacción que estaba fallando silenciosamente. La parte crítica es
  // el roster upsert atómico (upsertRosterMembership dentro de withTransaction).
  test('syncAthletes → roster upsert atómico (INSERT INTO athletes en tx)', async () => {
    // 1ra lectura: lineups con members; 2da: fresh rows (marca "frescos" → sin hidratar).
    setExecResults([
      [{ lineups: { members: [{ athleteId: 100, name: 'Mbappé' }] } }],
      [{ id: 100, updated_at: '2026-07-28T00:00:00Z', has_trophies: true, has_transfers: true, has_career: true }],
    ]);
    await sync.syncAthletes();
    const writes = getWrites();
    expect(writes.some((w) => w.via === 'tx' && /INTO athletes/.test(w.sql))).toBe(true);
  });

  // Job de transacción que estaba fallando silenciosamente. Escribe competitions
  // (upsertMany) + competidores canónicos + junction dentro de withTransaction.
  test('syncCatalog → competitions + competitors canónicos (tx) + junction', async () => {
    api.getCompetition.mockResolvedValue({ competitions: [{ id: 5930, name: 'Mundial' }] });
    api.getStandings.mockResolvedValue({ standings: [{ rows: [{ competitor: { id: 100, name: 'Brasil' } }] }] });
    api.getTopCompetitors.mockResolvedValue({ competitors: [] });
    await sync.syncCatalog();
    const writes = getWrites();
    expect(writes.some((w) => /INSERT INTO competitions/.test(w.sql))).toBe(true);
    // upsertCompetitorCanonical corre dentro de withTransaction (DELETE + INSERT).
    expect(writes.some((w) => w.via === 'tx' && /INSERT INTO competitors/.test(w.sql))).toBe(true);
  });
});
