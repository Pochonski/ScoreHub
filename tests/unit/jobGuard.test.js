/**
 * tests/unit/jobGuard.test.js — Auditoría 2026-Q3 Fase 5.4 + Fase 8.4
 *
 * Tests del mutex per-nombre en utils/jobGuard.js.
 */

process.env.NODE_ENV = 'test';

const jobGuard = require('../../utils/jobGuard');

describe('unit/jobGuard — mutex per-nombre', () => {
  beforeEach(() => {
    // Reset internal state via fresh require — no public reset API.
    jest.resetModules();
  });

  test('wrap ejecuta la función la primera vez', async () => {
    const guard = require('../../utils/jobGuard');
    const fn = jest.fn().mockResolvedValue('ok');
    const wrapped = guard.wrap('test-1', fn);
    await wrapped();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('wrap skip si ya está corriendo', async () => {
    const guard = require('../../utils/jobGuard');
    let resolveFirst;
    const fn = jest.fn().mockImplementation(
      () => new Promise((r) => { resolveFirst = r; })
    );
    const wrapped = guard.wrap('test-2', fn);

    // Primera llamada: queda pendiente
    const p1 = wrapped();
    // Segunda llamada mientras la primera corre: debe skip
    await wrapped();

    expect(fn).toHaveBeenCalledTimes(1);

    // Liberar la primera
    resolveFirst();
    await p1;
  });

  test('lock se libera tras error → siguiente request ejecuta fn', async () => {
    const guard = require('../../utils/jobGuard');
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    const wrapped = guard.wrap('test-3', fn);

    await expect(wrapped()).resolves.toBeUndefined(); // error swallowed
    await wrapped();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('100 Promise.all paralelos → fn se ejecuta 1 vez', async () => {
    const guard = require('../../utils/jobGuard');
    let resolveFirst;
    const fn = jest.fn().mockImplementation(
      () => new Promise((r) => { resolveFirst = r; })
    );
    const wrapped = guard.wrap('test-stampede', fn);

    const promises = Array.from({ length: 100 }, () => wrapped());
    resolveFirst();
    await Promise.all(promises);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('isRunning refleja el estado actual', async () => {
    const guard = require('../../utils/jobGuard');
    let resolveFirst;
    const fn = jest.fn().mockImplementation(
      () => new Promise((r) => { resolveFirst = r; })
    );
    const wrapped = guard.wrap('test-running', fn);

    expect(guard.isRunning('test-running')).toBe(false);
    const p = wrapped();
    expect(guard.isRunning('test-running')).toBe(true);
    resolveFirst();
    await p;
    expect(guard.isRunning('test-running')).toBe(false);
  });
});