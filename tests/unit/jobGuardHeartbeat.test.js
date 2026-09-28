/**
 * tests/unit/jobGuardHeartbeat.test.js — heartbeat a sync_health desde jobGuard.
 */
process.env.NODE_ENV = 'test';

describe('unit/jobGuard — heartbeat', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('wrap llama recordHeartbeat con ok:true al terminar', async () => {
    const guard = require('../../utils/jobGuard');
    const record = jest.fn();
    const wrapped = guard.wrap('hb-ok', jest.fn().mockResolvedValue('ok'), {
      recordHeartbeat: record,
    });
    await wrapped();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({ name: 'hb-ok', ok: true, errMsg: null });
    expect(typeof record.mock.calls[0][0].durationMs).toBe('number');
  });

  test('wrap llama recordHeartbeat con ok:false y mensaje al fallar', async () => {
    const guard = require('../../utils/jobGuard');
    const record = jest.fn();
    const wrapped = guard.wrap(
      'hb-err',
      jest.fn().mockRejectedValue(new Error('boom')),
      { recordHeartbeat: record }
    );
    await wrapped(); // error tragado por el guard
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({ name: 'hb-err', ok: false, errMsg: 'boom' });
  });

  test('sin recordHeartbeat en test: no toca DB (rápido y sin throw)', async () => {
    const guard = require('../../utils/jobGuard');
    const wrapped = guard.wrap('hb-skip', jest.fn().mockResolvedValue('ok'));
    await expect(wrapped()).resolves.toBeUndefined();
  });

  test('un recordHeartbeat que lanza no rompe el job', async () => {
    const guard = require('../../utils/jobGuard');
    const fn = jest.fn().mockResolvedValue('ok');
    const wrapped = guard.wrap('hb-throw', fn, {
      recordHeartbeat: () => { throw new Error('db down'); },
    });
    await expect(wrapped()).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
