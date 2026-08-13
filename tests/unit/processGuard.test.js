/**
 * tests/unit/processGuard.test.js — Auditoría 2026-Q3 Fase 8.3
 *
 * Tests del guard de proceso (unhandledRejection + uncaughtException).
 * CUIDADO: estos tests manipulan process.on() — se hace cleanup en afterEach.
 */

process.env.NODE_ENV = 'test';

describe('utils/processGuard — crash policy', () => {
  let realExit;
  let exitCode;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    exitCode = null;
    // Mockear process.exit para no matar el test runner.
    realExit = process.exit;
    process.exit = (code) => { exitCode = code; };
    logger = { error: jest.fn(), warn: jest.fn() };
  });

  afterEach(() => {
    process.exit = realExit;
  });

  test('install registra handlers sin lanzar', () => {
    const { install } = require('../../utils/processGuard');
    expect(() => install({ name: 'test', logger })).not.toThrow();
  });

  test('unhandledRejection se loguea vía logger', () => {
    const { install } = require('../../utils/processGuard');
    install({ name: 'test', logger });

    // Emitir un unhandledRejection sintético.
    process.emit('unhandledRejection', new Error('synthetic'), Promise.resolve());

    expect(logger.error).toHaveBeenCalled();
    const msg = logger.error.mock.calls[0][0];
    expect(msg).toMatch(/unhandledRejection/);
  });

  test('unhandledRejection NO mata el proceso', () => {
    const { install } = require('../../utils/processGuard');
    install({ name: 'test', logger });

    process.emit('unhandledRejection', new Error('synthetic'), Promise.resolve());

    // exit NO debe haber sido llamado.
    expect(exitCode).toBeNull();
  });

  test('uncaughtException mata el proceso con exit code 1', () => {
    const { install } = require('../../utils/processGuard');
    install({ name: 'test', logger });

    process.emit('uncaughtException', new Error('boom'));

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalled();
    const msg = logger.error.mock.calls[0][0];
    expect(msg).toMatch(/uncaughtException/);
  });

  test('install sin logger usa console como fallback', () => {
    const { install } = require('../../utils/processGuard');
    // No debe lanzar si no se pasa logger.
    expect(() => install({ name: 'test' })).not.toThrow();
  });
});