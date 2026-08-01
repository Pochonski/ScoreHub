/**
 * tests/unit/readThrough.test.js — Fase 8.4
 *
 * Tests del patrón read-through cache en database/db.js.
 * Estrategia: mockear `../database/connection` (pool) y `../utils/dbStats`
 * para que `readThrough` corra en aislamiento total.
 */

process.env.NODE_ENV = 'test';

// Mockear la conexión pg antes que nada.
jest.mock('../../database/connection', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
  pgQueryRetry: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  withTransaction: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
}));

// Mockear el supabaseClient.
jest.mock('../../database/supabaseClient', () => ({
  getClient: jest.fn(),
  isEnabled: () => false,
}));

// Mockear dbStats y logger.
jest.mock('../../utils/dbStats', () => ({
  recordUpsertFromCacheMiss: jest.fn(),
  recordReadThroughHit: jest.fn(),
  recordSupabaseCall: jest.fn(),
  recordSupabaseError: jest.fn(),
  recordPgCall: jest.fn(),
  recordPgError: jest.fn(),
  getStats: jest.fn().mockReturnValue({}),
  reset: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

// Requerir DESPUÉS de los mocks.
const db = require('../../database/db');
const dbStats = require('../../utils/dbStats');

describe('unit/readThrough — patrón cache miss + write-back', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cache hit → devuelve sin llamar fetcher ni upsert', async () => {
    // pg.fallback: SELECT devuelve una fila
    const { pgQueryRetry } = require('../../database/connection');
    pgQueryRetry.mockResolvedValueOnce({
      rows: [{ id: 1, data: { foo: 'bar' }, updated_at: new Date().toISOString() }],
      rowCount: 1,
    });

    const fetcher = jest.fn().mockResolvedValue({ foo: 'baz' });

    const result = await db.readThrough(
      'whatever',
      { select: 'data', eq: { id: 1 }, maybeSingle: true },
      fetcher,
      { onConflict: 'id' }
    );

    expect(result.source).toBe('db');
    expect(fetcher).not.toHaveBeenCalled();
    expect(dbStats.recordUpsertFromCacheMiss).not.toHaveBeenCalled();
  });

  test('cache miss → fetcher llamado + upsert persistido + recordUpsertFromCacheMiss', async () => {
    const { pool, pgQueryRetry } = require('../../database/connection');
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    pgQueryRetry.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // upsert call
    const fetcher = jest.fn().mockResolvedValue({ id: 1, foo: 'fresh' });

    const result = await db.readThrough(
      'whatever',
      { select: '*', eq: { id: 1 } },
      fetcher,
      { onConflict: 'id' }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(dbStats.recordUpsertFromCacheMiss).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('365+writeback');
    expect(result.data).toEqual({ id: 1, foo: 'fresh' });
  });

  test('cache stale (ttlMs excedido) → fetcher llamado', async () => {
    const staleIso = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const { pgQueryRetry } = require('../../database/connection');
    pgQueryRetry
      .mockResolvedValueOnce({
        rows: [{ id: 1, data: { foo: 'old' }, updated_at: staleIso }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const fetcher = jest.fn().mockResolvedValue({ id: 1, foo: 'fresh' });

    const result = await db.readThrough(
      'whatever',
      { select: '*', eq: { id: 1 }, maybeSingle: true },
      fetcher,
      { onConflict: 'id', ttlMs: 60 * 1000 }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('365+writeback');
  });

  test('cache fresh dentro de ttl → no llama fetcher', async () => {
    const freshIso = new Date(Date.now() - 5 * 1000).toISOString();
    const { pgQueryRetry } = require('../../database/connection');
    pgQueryRetry.mockResolvedValueOnce({
      rows: [{ id: 1, data: { foo: 'fresh' }, updated_at: freshIso }],
      rowCount: 1,
    });
    const fetcher = jest.fn().mockResolvedValue({ id: 1, foo: 'even_fresher' });

    const result = await db.readThrough(
      'whatever',
      { select: '*', eq: { id: 1 }, maybeSingle: true },
      fetcher,
      { onConflict: 'id', ttlMs: 60 * 1000 }
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.source).toBe('db');
  });

  test('cache miss + fetcher falla + sin row → 365-error', async () => {
    const { pgQueryRetry } = require('../../database/connection');
    pgQueryRetry.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const fetcher = jest.fn().mockRejectedValue(new Error('upstream 500'));

    const result = await db.readThrough(
      'whatever',
      { select: '*', eq: { id: 1 } },
      fetcher,
      { onConflict: 'id' }
    );

    expect(result.source).toBe('365-error');
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });
});