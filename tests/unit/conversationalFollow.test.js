/**
 * tests/unit/conversationalFollow.test.js — Verificación del use-case conversationalFollow (Fase 8).
 */

const {
  createHandleConversationalMessage,
  CONFIDENCE_THRESHOLD,
} = require('../../src/application/bets/conversationalFollow');

function makeIntentParser(overrides = {}) {
  return {
    parseIntent: jest.fn(),
    isConfident: jest.fn(),
    ...overrides,
  };
}

function makeFollowUseCase(overrides = {}) {
  return {
    followTicket: jest.fn(),
    unfollowTicket: jest.fn(),
    listFollowed: jest.fn(),
    changeMode: jest.fn(),
    ...overrides,
  };
}

function makeContext(overrides = {}) {
  return {
    summarize: jest.fn(),
    getRecentTickets: jest.fn(),
    rememberTicket: jest.fn(),
    ...overrides,
  };
}

describe('createHandleConversationalMessage', () => {
  test('throws if intentParser missing', () => {
    expect(() => createHandleConversationalMessage({})).toThrow(/intentParser required/);
  });

  test('throws if followTicketUseCase missing', () => {
    expect(() => createHandleConversationalMessage({ intentParser: makeIntentParser() })).toThrow(/followTicketUseCase required/);
  });

  test('throws if context missing', () => {
    expect(() => createHandleConversationalMessage({
      intentParser: makeIntentParser(), followTicketUseCase: makeFollowUseCase(),
    })).toThrow(/context required/);
  });

  test('returns handled:false when text empty', async () => {
    const uc = createHandleConversationalMessage({
      intentParser: makeIntentParser(),
      followTicketUseCase: makeFollowUseCase(),
      context: makeContext(),
    });
    expect(await uc('u1', '')).toEqual({ handled: false });
    expect(await uc('u1', '   ')).toEqual({ handled: false });
  });

  test('returns handled:false when not confident', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'chat' });
    intentParser.isConfident.mockReturnValue(false);
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: makeFollowUseCase(),
      context: makeContext(),
    });
    expect(await uc('u1', 'hola')).toEqual({ handled: false, intent: { intent: 'chat' }, message: null });
  });

  test('follow intent: returns error when no ticket', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'follow' });
    intentParser.isConfident.mockReturnValue(true);
    const context = makeContext();
    context.getRecentTickets.mockReturnValue([]);
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: makeFollowUseCase(),
      context,
    });
    const r = await uc('u1', 'seguime un ticket');
    expect(r.handled).toBe(true);
    expect(r.message).toMatch(/¿Qué ticket querés seguir/);
  });

  test('follow intent: calls use-case when ticketId present', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'follow', ticketId: 555, mode: 'all_events' });
    intentParser.isConfident.mockReturnValue(true);
    const followUC = makeFollowUseCase();
    followUC.followTicket.mockResolvedValue({ ok: true, message: '✅ siguiendo' });
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: followUC,
      context: makeContext(),
    });
    const r = await uc('u1', 'sígueme el 555');
    expect(followUC.followTicket).toHaveBeenCalledWith('u1', 555, 'all_events');
    expect(r.message).toBe('✅ siguiendo');
  });

  test('unfollow intent: falls back to recent ticket', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'unfollow' });
    intentParser.isConfident.mockReturnValue(true);
    const context = makeContext();
    context.getRecentTickets.mockReturnValue([555]);
    const followUC = makeFollowUseCase();
    followUC.unfollowTicket.mockResolvedValue({ ok: true, message: '✅ dejado' });
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: followUC,
      context,
    });
    const r = await uc('u1', 'dejame de seguir');
    expect(followUC.unfollowTicket).toHaveBeenCalledWith('u1', 555);
    expect(r.message).toBe('✅ dejado');
  });

  test('list_followed intent: calls use-case', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'list_followed' });
    intentParser.isConfident.mockReturnValue(true);
    const followUC = makeFollowUseCase();
    followUC.listFollowed.mockResolvedValue({ ok: true, message: '📋 lista' });
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: followUC,
      context: makeContext(),
    });
    expect((await uc('u1', 'mis seguidos')).message).toBe('📋 lista');
  });

  test('change_mode intent: returns error when missing fields', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'change_mode' });
    intentParser.isConfident.mockReturnValue(true);
    const context = makeContext();
    context.getRecentTickets.mockReturnValue([]);
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: makeFollowUseCase(),
      context,
    });
    const r = await uc('u1', 'cambia modo');
    expect(r.message).toMatch(/Necesito el ticket y el modo/);
  });

  test('change_mode intent: calls use-case with fallback ticket', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'change_mode', mode: 'outcome_only' });
    intentParser.isConfident.mockReturnValue(true);
    const context = makeContext();
    context.getRecentTickets.mockReturnValue([666]);
    const followUC = makeFollowUseCase();
    followUC.changeMode.mockResolvedValue({ ok: true, message: '✅ modo cambiado' });
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: followUC,
      context,
    });
    const r = await uc('u1', 'cambia a outcome');
    expect(followUC.changeMode).toHaveBeenCalledWith('u1', 666, 'outcome_only');
    expect(r.message).toBe('✅ modo cambiado');
  });

  test('returns handled:false for chat/stats/live/unknown intents', async () => {
    const intentParser = makeIntentParser();
    intentParser.parseIntent.mockResolvedValue({ intent: 'chat' });
    intentParser.isConfident.mockReturnValue(true);
    const uc = createHandleConversationalMessage({
      intentParser,
      followTicketUseCase: makeFollowUseCase(),
      context: makeContext(),
    });
    const r = await uc('u1', 'hola');
    expect(r.handled).toBe(false);
  });

  test('exports CONFIDENCE_THRESHOLD', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.6);
  });
});
