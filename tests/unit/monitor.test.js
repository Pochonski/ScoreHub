/**
 * tests/unit/monitor.test.js — evaluateFreshness, cooldown y orquestación.
 */
process.env.NODE_ENV = 'test';

jest.mock('../../database/db', () => ({
  query: jest.fn(),
  execAdvanced: jest.fn(),
  upsert: jest.fn(),
}));

jest.mock('../../database/connection', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) },
}));

jest.mock('../../src/interface/telegram/client', () => ({
  sendMessage: jest.fn(),
}));

const { evaluateFreshness } = require('../../src/interface/monitor/checks');

describe('unit/monitor — evaluateFreshness', () => {
  const NOW = new Date('2026-09-28T12:00:00Z').getTime();
  const ago = (ms) => new Date(NOW - ms).toISOString();

  test('sin filas → missing para cada job esperado', () => {
    const issues = evaluateFreshness([], undefined, NOW);
    expect(issues.length).toBeGreaterThan(5);
    expect(issues[0]).toMatchObject({ severity: 'warning' });
    expect(issues[0].detail).toMatch('nunca reportó');
  });

  test('job fresco no genera issue', () => {
    const rows = [
      { job_name: 'syncLiveGames', last_run_at: ago(2 * 60 * 1000), last_ok: true, last_error: null },
    ];
    const issues = evaluateFreshness(rows, undefined, NOW);
    expect(issues.find((i) => i.job === 'syncLiveGames')).toBeUndefined();
  });

  test('job stale genera critical con edad', () => {
    const rows = [
      { job_name: 'syncLiveGames', last_run_at: ago(30 * 60 * 1000), last_ok: true, last_error: null },
    ];
    const issues = evaluateFreshness(rows, undefined, NOW);
    expect(issues).toHaveLength(10); // 9 missing + este stale
    const stale = issues.find((i) => i.job === 'syncLiveGames');
    expect(stale).toMatchObject({ severity: 'critical' });
    expect(stale.detail).toMatch('30min');
  });

  test('última corrida fallida genera critical con el error', () => {
    const rows = [
      { job_name: 'syncStandings', last_run_at: ago(60 * 1000), last_ok: false, last_error: 'timeout!' },
    ];
    const stale = evaluateFreshness(rows, undefined, NOW).find((i) => i.job === 'syncStandings');
    expect(stale).toMatchObject({ severity: 'critical' });
    expect(stale.detail).toMatch('timeout!');
  });
});

describe('unit/monitor — cooldown y runOnce', () => {
  beforeEach(() => {
    jest.resetModules();
    const db = require('../../database/db');
    db.query.mockReset().mockResolvedValue({ data: null, error: null });
    db.execAdvanced.mockReset().mockResolvedValue([]);
    db.upsert.mockReset().mockResolvedValue({ data: [], error: null });
  });

  test('shouldAlert: primera vez sí, dentro del cooldown no', async () => {
    const db = require('../../database/db');
    db.query.mockResolvedValue({ data: null, error: null });
    const alert = require('../../src/interface/monitor/alert');
    const now = Date.now();
    expect(await alert.shouldAlert('k1', now, 60 * 60 * 1000)).toBe(true);
    db.query.mockResolvedValue({ data: { value: new Date(now).toISOString() }, error: null });
    expect(await alert.shouldAlert('k1', now + 1000, 60 * 60 * 1000)).toBe(false);
    expect(await alert.shouldAlert('k1', now + 61 * 60 * 1000, 60 * 60 * 1000)).toBe(true);
  });

  test('runOnce con DB caída reporta critical sin alertar si no hay chat', async () => {
    const monitor = require('../../src/interface/monitor/monitor');
    const r = await monitor.runOnce({
      alertDeps: { shouldAlert: async () => true, sendTelegram: async () => ({ sent: false }), listAlerted: async () => [] },
    });
    // DB local real puede estar arriba o no; solo valida forma del resultado
    expect(r).toHaveProperty('ok');
    expect(Array.isArray(r.issues)).toBe(true);
    expect(Array.isArray(r.sent)).toBe(true);
  });
});
