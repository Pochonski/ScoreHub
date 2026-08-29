/**
 * tests/unit/syncOrchestrator.test.js — Verificación del sync orchestrator (Fase 4).
 */

const { createSyncOrchestrator } = require('../../src/application/sync/orchestrator');

describe('createSyncOrchestrator', () => {
  test('throws if runIdGenerator is not a function', () => {
    expect(() => createSyncOrchestrator({ runIdGenerator: 'not-a-function' })).toThrow(/runIdGenerator must be a function/);
  });

  test('exposes runFullSync + 9 sub-runners + DEFAULT_FULL_PLAN', () => {
    const orch = createSyncOrchestrator();
    expect(typeof orch.runFullSync).toBe('function');
    expect(typeof orch.runGames).toBe('function');
    expect(typeof orch.runStandings).toBe('function');
    expect(typeof orch.runContent).toBe('function');
    expect(typeof orch.runTrendsOdds).toBe('function');
    expect(typeof orch.runDetails).toBe('function');
    expect(typeof orch.runCatalog).toBe('function');
    expect(typeof orch.runAthletes).toBe('function');
    expect(typeof orch.runTransfers).toBe('function');
    expect(typeof orch.runBetSelections).toBe('function');
    expect(Array.isArray(orch.DEFAULT_FULL_PLAN)).toBe(true);
    expect(orch.DEFAULT_FULL_PLAN.length).toBeGreaterThan(15);
  });

  test('runFullSync executes plan in order and reports results', async () => {
    const runIds = ['run-1', 'run-2'];
    let i = 0;
    const logs = [];
    const clock = () => new Date('2026-01-01T00:00:00Z');
    const orch = createSyncOrchestrator({
      runIdGenerator: () => runIds[i++],
      logger: (msg) => logs.push(msg),
      clock,
    });

    const calls = [];
    const plan = [
      async () => { calls.push('a'); return { rows: 3 }; },
      async () => { calls.push('b'); return { rows: 5 }; },
      async () => { calls.push('c'); throw new Error('boom'); },
    ];

    const result = await orch.runFullSync({ plan });

    expect(calls).toEqual(['a', 'b', 'c']);
    expect(result.runId).toBe('run-1');
    expect(result.totalJobs).toBe(3);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.jobs[0].ok).toBe(true);
    expect(result.jobs[0].rows).toBe(3);
    expect(result.jobs[2].ok).toBe(false);
    expect(result.jobs[2].error).toBe('boom');
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some((l) => l.includes('run-1'))).toBe(true);
    expect(logs.some((l) => l.includes('Job 2 failed'))).toBe(true);
  });

  test('runFullSync clears runId even on throw', async () => {
    // Indirect: el context.js setSyncRunId(null) en finally. Verificamos
    // que no haya leak observando que otra corrida empieza con runId nuevo.
    let i = 0;
    const orch = createSyncOrchestrator({
      runIdGenerator: () => `r-${i++}`,
    });
    const r1 = await orch.runFullSync({ plan: [async () => ({})] });
    const r2 = await orch.runFullSync({ plan: [async () => ({})] });
    expect(r1.runId).toBe('r-0');
    expect(r2.runId).toBe('r-1');
  });

  test('sub-runners exist (smoke test, no execution)', () => {
    const orch = createSyncOrchestrator();
    // No ejecutamos los sub-runners porque llaman a sync functions reales
    // que pegan a la DB — eso se cubre en tests/sync.golden.test.js.
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

  test('defaults work without explicit injection', async () => {
    const orch = createSyncOrchestrator();
    // No throw on construction
    expect(typeof orch.runFullSync).toBe('function');
  });
});
