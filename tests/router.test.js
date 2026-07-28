/**
 * Tests del router de comandos (Fase 7, Fase 2).
 */

const { createRouter, normalize } = require('../src/interface/telegram/router');

describe('router — normalize', () => {
  test('lowercasea, trimea y quita @botmundialistabot', () => {
    expect(normalize('  /Live@botmundialistabot ')).toBe('/live');
    expect(normalize('/ENVIVO')).toBe('/envivo');
  });
});

describe('router — dispatch', () => {
  test('despacha un comando registrado y devuelve true', async () => {
    const router = createRouter();
    const handler = jest.fn();
    router.register(['/live', '/envivo'], handler);
    const ok = await router.dispatch({ cmd: '/live' });
    expect(ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('matchea aliases y la variante @botmundialistabot', async () => {
    const router = createRouter();
    const handler = jest.fn();
    router.register(['/live', '/envivo'], handler);
    expect(await router.dispatch({ cmd: '/envivo' })).toBe(true);
    expect(await router.dispatch({ cmd: '/live@botmundialistabot' })).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  test('comando no registrado → false (cae a legacy)', async () => {
    const router = createRouter();
    router.register(['/live'], jest.fn());
    expect(await router.dispatch({ cmd: '/tabla' })).toBe(false);
  });

  test('pasa el ctx al handler', async () => {
    const router = createRouter();
    const handler = jest.fn();
    router.register(['/help'], handler);
    const ctx = { cmd: '/help', chatId: 1, userId: 2 };
    await router.dispatch(ctx);
    expect(handler).toHaveBeenCalledWith(ctx);
  });

  test('registrar un trigger duplicado lanza error', () => {
    const router = createRouter();
    router.register(['/live'], jest.fn());
    expect(() => router.register(['/live'], jest.fn())).toThrow(/duplicado/);
  });

  test('has() reporta si un comando está registrado', () => {
    const router = createRouter();
    router.register(['/fixture', '/calendario'], jest.fn());
    expect(router.has('/calendario')).toBe(true);
    expect(router.has('/fixture@botmundialistabot')).toBe(true);
    expect(router.has('/nope')).toBe(false);
  });
});
