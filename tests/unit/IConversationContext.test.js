/**
 * tests/unit/IConversationContext.test.js — Verificación del puerto + adapter de conversation context.
 */

const { createConversationContext, REQUIRED_METHODS } = require('../../src/domain/ports/IConversationContext');
const { createConversationContextAdapter } = require('../../src/infrastructure/conversation/ConversationContextAdapter');

function makeAdapter(overrides = {}) {
  return {
    summarize: jest.fn(),
    rememberTicket: jest.fn(),
    rememberGame: jest.fn(),
    getDefaultMode: jest.fn(),
    setDefaultMode: jest.fn(),
    getRecentTickets: jest.fn(),
    getRecentGames: jest.fn(),
    flushSync: jest.fn(),
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

describe('createConversationContext — Proxy enforcement', () => {
  test('throws if adapter is not an object', () => {
    expect(() => createConversationContext(null)).toThrow(/adapter must be an object/);
  });

  test('REQUIRED_METHODS has 8 entries', () => {
    expect(REQUIRED_METHODS.length).toBe(8);
    expect(REQUIRED_METHODS).toContain('summarize');
    expect(REQUIRED_METHODS).toContain('rememberTicket');
    expect(REQUIRED_METHODS).toContain('flushSync');
  });

  test('passes through all methods', () => {
    const adapter = makeAdapter({
      summarize: jest.fn().mockReturnValue({ recentTickets: ['555'] }),
      rememberTicket: jest.fn(),
      flushSync: jest.fn(),
    });
    const ctx = createConversationContext(adapter);
    expect(ctx.summarize('u1')).toEqual({ recentTickets: ['555'] });
    ctx.rememberTicket('u1', '555');
    expect(adapter.rememberTicket).toHaveBeenCalledWith('u1', '555');
  });

  test('throws on missing method via Proxy', () => {
    const adapter = makeAdapter();
    delete adapter.summarize;
    const ctx = createConversationContext(adapter);
    expect(() => ctx.summarize('u1')).toThrow(/is not implemented/);
  });
});

describe('createConversationContextAdapter', () => {
  test('throws if legacy module missing', () => {
    expect(() => createConversationContextAdapter(null)).toThrow(/legacyModule required/);
  });

  test('wraps legacy module with Proxy', () => {
    const legacyModule = makeAdapter();
    legacyModule.summarize = jest.fn().mockReturnValue({ recentTickets: ['x'] });
    const adapter = createConversationContextAdapter(legacyModule);
    expect(adapter.summarize('u1')).toEqual({ recentTickets: ['x'] });
  });

  test('throws boot-time if any required method missing', () => {
    const legacyModule = makeAdapter();
    delete legacyModule.flushSync;
    expect(() => createConversationContextAdapter(legacyModule))
      .toThrow(/flushSync is not a function/);
  });
});
