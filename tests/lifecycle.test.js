/**
 * Red de caracterización del lifecycle (Fase 7, Fase 1).
 *
 * Testea el ruteo de updates y el long-polling de src/interface/telegram/
 * lifecycle.js con todas las dependencias inyectadas como fakes. Captura el
 * comportamiento actual durante la extracción desde telegramBot.js.
 */

process.env.NODE_ENV = 'test';

const { createLifecycle } = require('../src/interface/telegram/lifecycle');

const silentLogger = { info() {}, warn() {}, error() {} };

function build(overrides = {}) {
  const deps = {
    telegramRequest: jest.fn().mockResolvedValue({ ok: true }),
    processMessage: jest.fn(),
    handlePartidosCallback: jest.fn(),
    logger: silentLogger,
    testConnection: jest.fn().mockResolvedValue(false),
    setDbAvailable: jest.fn(),
    ...overrides,
  };
  return { lc: createLifecycle(deps), deps };
}

describe('lifecycle — handleWebhookUpdate (ruteo)', () => {
  test('callback_query con acción conocida → answerCallbackQuery + handlePartidosCallback', async () => {
    const { lc, deps } = build();
    await lc.handleWebhookUpdate({
      callback_query: { id: 'cb1', data: 'odds_123', message: { chat: { id: 55 } } },
    });
    expect(deps.telegramRequest).toHaveBeenCalledWith('answerCallbackQuery', { callback_query_id: 'cb1' });
    expect(deps.handlePartidosCallback).toHaveBeenCalledWith(55, 'odds_123');
    expect(deps.processMessage).not.toHaveBeenCalled();
  });

  test('callback_query con acción desconocida → NO llama handlePartidosCallback', async () => {
    const { lc, deps } = build();
    await lc.handleWebhookUpdate({
      callback_query: { id: 'cb2', data: 'foo_9', message: { chat: { id: 55 } } },
    });
    expect(deps.telegramRequest).toHaveBeenCalledWith('answerCallbackQuery', { callback_query_id: 'cb2' });
    expect(deps.handlePartidosCallback).not.toHaveBeenCalled();
  });

  test('mensaje privado con texto → processMessage (texto trimmeado)', async () => {
    const { lc, deps } = build();
    await lc.handleWebhookUpdate({
      message: { chat: { id: 7, type: 'private' }, from: { id: 42, username: 'neo' }, text: '  /live  ' },
    });
    expect(deps.processMessage).toHaveBeenCalledWith(7, 42, '/live', 'neo');
  });

  test('mensaje de grupo (no private) → ignorado', async () => {
    const { lc, deps } = build();
    await lc.handleWebhookUpdate({
      message: { chat: { id: 7, type: 'group' }, from: { id: 42 }, text: 'hola' },
    });
    expect(deps.processMessage).not.toHaveBeenCalled();
  });

  test('mensaje sin texto → ignorado', async () => {
    const { lc, deps } = build();
    await lc.handleWebhookUpdate({ message: { chat: { id: 7, type: 'private' }, from: { id: 42 } } });
    expect(deps.processMessage).not.toHaveBeenCalled();
  });

  test('usa first_name si no hay username', async () => {
    const { lc, deps } = build();
    await lc.handleWebhookUpdate({
      message: { chat: { id: 7, type: 'private' }, from: { id: 42, first_name: 'Trinity' }, text: 'x' },
    });
    expect(deps.processMessage).toHaveBeenCalledWith(7, 42, 'x', 'Trinity');
  });
});

describe('lifecycle — processUpdates', () => {
  test('itera result y rutea cada update', async () => {
    const { lc, deps } = build();
    await lc.processUpdates({
      ok: true,
      result: [
        { message: { chat: { id: 1, type: 'private' }, from: { id: 1, username: 'a' }, text: 'x' } },
        { message: { chat: { id: 2, type: 'private' }, from: { id: 2, username: 'b' }, text: 'y' } },
      ],
    });
    expect(deps.processMessage).toHaveBeenCalledTimes(2);
  });

  test('updates no-ok → no hace nada', async () => {
    const { lc, deps } = build();
    await lc.processUpdates({ ok: false });
    expect(deps.processMessage).not.toHaveBeenCalled();
  });
});

describe('lifecycle — fetchOnce', () => {
  test('rutea updates y avanza pollOffset (offset = lastUpdateId + 1)', async () => {
    const telegramRequest = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        result: [{ update_id: 10, message: { chat: { id: 1, type: 'private' }, from: { id: 2, username: 'u' }, text: 'hola' } }],
      })
      .mockResolvedValueOnce({ ok: true, result: [] });
    const { lc, deps } = build({ telegramRequest });
    await lc.fetchOnce();
    expect(deps.processMessage).toHaveBeenCalledWith(1, 2, 'hola', 'u');
    // La primera llamada no lleva offset (pollOffset=0).
    expect(telegramRequest.mock.calls[0][1]).not.toHaveProperty('offset');
    await lc.fetchOnce();
    // La segunda sí, con lastUpdateId + 1 = 11.
    expect(telegramRequest).toHaveBeenLastCalledWith('getUpdates', expect.objectContaining({ offset: 11 }), 35000);
  });
});

describe('lifecycle — init', () => {
  test('publica dbAvailable y llama deleteWebhook', async () => {
    const telegramRequest = jest.fn((method) => {
      if (method === 'getUpdates') return new Promise(() => {}); // pending → el loop no spinea
      return Promise.resolve({ ok: true });
    });
    const setDbAvailable = jest.fn();
    const { lc } = build({ telegramRequest, testConnection: jest.fn().mockResolvedValue(true), setDbAvailable });
    await lc.init();
    await new Promise((r) => setImmediate(r)); // flush del .then(testConnection)
    expect(telegramRequest).toHaveBeenCalledWith('deleteWebhook', { drop_pending_updates: false });
    expect(setDbAvailable).toHaveBeenCalledWith(true);
    lc.stop();
  });
});
