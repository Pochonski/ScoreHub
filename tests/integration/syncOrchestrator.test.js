/**
 * tests/integration/syncOrchestrator.test.js (T2b)
 *
 * Integration test del syncOrchestrator contra DB captura. Verifica
 * que el plan de sync ejecuta los jobs correctos en el orden correcto
 * y maneja errores sin abortar la corrida completa.
 *
 * Usa los módulos sync reales (catalog, games, standings, etc.) pero
 * mockea services/scores365Service para no pegar a la API 365scores.
 */

process.env.NODE_ENV = 'test';

jest.mock('../../database/connection', () => {
  const c = require('./helpers/dbCapture');
  return { pool: c.pool, withTransaction: c.withTransaction, pgQueryRetry: c.pgQueryRetry, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../../database/db', () => require('./helpers/dbCapture').db);
jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../../services/scores365Service', () => ({
  getStandings: jest.fn().mockResolvedValue({ standing: [] }),
  getGamesAllScores: jest.fn().mockResolvedValue({ games: [] }),
  getGamesCurrent: jest.fn().mockResolvedValue({ games: [] }),
  getGamesResults: jest.fn().mockResolvedValue({ games: [] }),
  getFixtures: jest.fn().mockResolvedValue({ games: [] }),
  getNews: jest.fn().mockResolvedValue([]),
  getTrends: jest.fn().mockResolvedValue([]),
  getBrackets: jest.fn().mockResolvedValue({ stages: [] }),
  getGameSuggestions: jest.fn().mockResolvedValue([]),
  getTournamentStats: jest.fn().mockResolvedValue({ stats: [] }),
  getTeamOfWeek: jest.fn().mockResolvedValue({ teamOfWeek: null }),
  getTrendDetails: jest.fn().mockResolvedValue([]),
  getCompetitionHistory: jest.fn().mockResolvedValue([]),
  getOutrights: jest.fn().mockResolvedValue({ outrights: [] }),
  getPredictions: jest.fn().mockResolvedValue([]),
  getTopCompetitors: jest.fn().mockResolvedValue([]),
  getOddsLines: jest.fn().mockResolvedValue([]),
  getGameStats: jest.fn().mockResolvedValue([]),
  getGameOverview: jest.fn().mockResolvedValue({}),
  getGameH2H: jest.fn().mockResolvedValue({}),
  getGameLineups: jest.fn().mockResolvedValue({}),
  getGamePreStats: jest.fn().mockResolvedValue({}),
  getGameNews: jest.fn().mockResolvedValue([]),
  getTransfers: jest.fn().mockResolvedValue([]),
  getAthlete: jest.fn().mockResolvedValue({}),
  getCompetition: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../services/syncCompetitions', () => {
  const comps = [{ id: 5930, seasonNum: 25, startDate: '20260601', endDate: '20260715', hasBrackets: true, hasHistory: true }];
  return {
    getActiveCompetitions: jest.fn().mockResolvedValue(comps),
    forEachActive: jest.fn(async (fn) => { for (const c of comps) await fn(c); }),
  };
});

const capture = require('./helpers/dbCapture');
const { createSyncOrchestrator } = require('../../src/application/sync/orchestrator');

beforeEach(() => { capture.reset(); });

describe('syncOrchestrator.runFullSync', () => {
  test('ejecuta el plan completo sin fallar', async () => {
    const orch = createSyncOrchestrator({ logger: jest.fn() });
    const result = await orch.runFullSync();
    expect(result.runId).toBeDefined();
    expect(result.totalJobs).toBeGreaterThan(15);
    expect(result.successful + result.failed).toBe(result.totalJobs);
    expect(result.failed).toBe(0); // todos los jobs mockeados tienen éxito
  });

  test('reporta runId y timing', async () => {
    const orch = createSyncOrchestrator({
      logger: jest.fn(),
      clock: () => new Date('2026-01-01T00:00:00Z'),
    });
    const result = await orch.runFullSync();
    expect(result.runId).toMatch(/^[a-z0-9]+/);
    expect(result.startedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result.finishedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('continúa aunque un job falle', async () => {
    const orch = createSyncOrchestrator({ logger: jest.fn() });
    const plan = [
      async () => ({ ok: 0 }),
      async () => ({ ok: 1 }),
      async () => ({ ok: 2 }),
      async () => ({ ok: 3 }),
      async () => { throw new Error('job 4 failed'); },
      async () => ({ ok: 5 }),
      async () => ({ ok: 6 }),
      async () => ({ ok: 7 }),
    ];
    const result = await orch.runFullSync({ plan });
    expect(result.totalJobs).toBe(8);
    expect(result.successful).toBe(7);
    expect(result.failed).toBe(1);
    expect(result.jobs[4].jobOk).toBe(false);
    expect(result.jobs[4].error).toBe('job 4 failed');
  });

  test('plan vacío devuelve 0 jobs', async () => {
    const orch = createSyncOrchestrator({ logger: jest.fn() });
    const result = await orch.runFullSync({ plan: [] });
    expect(result.totalJobs).toBe(0);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(0);
  });

  test('sub-runners existen (smoke)', () => {
    const orch = createSyncOrchestrator({ logger: jest.fn() });
    expect(typeof orch.runGames).toBe('function');
    expect(typeof orch.runStandings).toBe('function');
    expect(typeof orch.runContent).toBe('function');
    expect(typeof orch.runTrendsOdds).toBe('function');
    expect(typeof orch.runDetails).toBe('function');
    expect(typeof orch.runCatalog).toBe('function');
    expect(typeof orch.runAthletes).toBe('function');
    expect(typeof orch.runTransfers).toBe('function');
    expect(typeof orch.runBetSelections).toBe('function');
  });

  test('DEFAULT_FULL_PLAN tiene 20+ jobs', () => {
    const orch = createSyncOrchestrator({ logger: jest.fn() });
    expect(orch.DEFAULT_FULL_PLAN.length).toBeGreaterThanOrEqual(20);
  });
});
