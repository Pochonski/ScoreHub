/**
 * tests/unit/useNlu.test.js — Verificación del use-case useNlu (Fase 3).
 */

const { createUseNlu } = require('../../src/application/orchestration/useNlu');

function makeMessageHandler(overrides = {}) {
  return {
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

describe('createUseNlu', () => {
  test('throws if messageHandler missing', () => {
    expect(() => createUseNlu({})).toThrow(/messageHandler required/);
  });

  test('delegates with chatId, body, and reply callback', async () => {
    const messageHandler = jest.fn().mockResolvedValue();
    const useNlu = createUseNlu({ messageHandler, logger: silentLogger });
    const reply = jest.fn();

    await useNlu.delegate('u1', 'como quedo brasil', reply);

    expect(messageHandler).toHaveBeenCalledWith(null, {
      from: 'u1',
      body: 'como quedo brasil',
      hasMedia: false,
      reply,
    });
  });

  test('coerces chatId to string', async () => {
    const messageHandler = jest.fn().mockResolvedValue();
    const useNlu = createUseNlu({ messageHandler, logger: silentLogger });
    await useNlu.delegate(12345, 'body', jest.fn());
    expect(messageHandler.mock.calls[0][1].from).toBe('12345');
  });

  test('swallows errors and replies with friendly message', async () => {
    const messageHandler = jest.fn().mockRejectedValue(new Error('boom'));
    const reply = jest.fn();
    const useNlu = createUseNlu({ messageHandler, logger: silentLogger });
    await useNlu.delegate('u1', 'foo', reply);
    expect(reply).toHaveBeenCalledWith(expect.stringMatching(/No pude procesar tu consulta/));
  });

  test('swallows errors from reply itself', async () => {
    const messageHandler = jest.fn().mockRejectedValue(new Error('boom'));
    const reply = jest.fn().mockRejectedValue(new Error('cant reply'));
    const useNlu = createUseNlu({ messageHandler, logger: silentLogger });
    // No debe tirar excepción — el reply falló pero el handler ya está protegido
    await expect(useNlu.delegate('u1', 'foo', reply)).resolves.toBeUndefined();
  });

  test('logs errors via injected logger', async () => {
    const messageHandler = jest.fn().mockRejectedValue(new Error('boom'));
    const reply = jest.fn();
    const useNlu = createUseNlu({ messageHandler, logger: silentLogger });
    await useNlu.delegate('u1', 'foo', reply);
    expect(silentLogger.error).toHaveBeenCalledWith(expect.objectContaining({ err: 'boom' }), expect.any(String));
  });
});
