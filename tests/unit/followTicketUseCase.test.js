/**
 * tests/unit/followTicketUseCase.test.js — Verificación del use-case de follow (Fase 8).
 */

const {
  createFollowTicketUseCase,
  MAX_FOLLOWS_PER_CHAT,
  normalizeMode,
  MODE_LABELS,
} = require('../../src/application/bets/followTicket');

function makeRepo(overrides = {}) {
  return {
    getTicketSummary: jest.fn(),
    getForUser: jest.fn(),
    upsertForUser: jest.fn(),
    removeForUser: jest.fn(),
    removeAllForUser: jest.fn(),
    countByChat: jest.fn(),
    listByChat: jest.fn(),
    listByApuesta: jest.fn(),
    ...overrides,
  };
}

describe('normalizeMode', () => {
  test.each([
    ['all', 'all_events'],
    ['all_events', 'all_events'],
    ['todo', 'all_events'],
    ['todos', 'all_events'],
    ['outcome', 'outcome_only'],
    ['outcome_only', 'outcome_only'],
    ['final', 'outcome_only'],
    ['solo', 'outcome_only'],
    [undefined, 'all_events'],
    ['???', 'all_events'],
  ])('normalizeMode(%p) → %p', (input, expected) => {
    expect(normalizeMode(input)).toBe(expected);
  });
});

describe('createFollowTicketUseCase.followTicket', () => {
  test('rejects invalid ticketId', async () => {
    const repo = makeRepo();
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.followTicket('u1', 'abc');
    expect(r).toEqual({ ok: false, message: '❌ ticketId inválido.' });
    expect(repo.getTicketSummary).not.toHaveBeenCalled();
  });

  test('rejects when ticket does not exist', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue(null);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.followTicket('u1', '555');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/No encontré el ticket/);
  });

  test('rejects when ticket belongs to another user', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'other', estado: 'abierta' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.followTicket('u1', '555');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no es tuyo/);
  });

  test('rejects when ticket is not open', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'completada' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.followTicket('u1', '555');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/ya está completada/);
  });

  test('returns already-following when same mode', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta', partidoExtrado: 'Brasil vs Argentina' });
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.followTicket('u1', '555', 'all_events');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/Ya estás siguiendo/);
    expect(repo.upsertForUser).not.toHaveBeenCalled();
  });

  test('switches mode: removes old, upserts new', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta', partidoExtrado: 'Brasil vs Argentina' });
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    repo.countByChat.mockResolvedValue(2);
    const rememberTicket = jest.fn();
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo, rememberTicket });
    const r = await uc.followTicket('u1', '555', 'outcome_only');
    expect(r.ok).toBe(true);
    expect(repo.removeForUser).toHaveBeenCalledWith(555, 'u1', 'all_events');
    expect(repo.upsertForUser).toHaveBeenCalledWith(555, 'u1', 'outcome_only', null);
    expect(rememberTicket).toHaveBeenCalledWith('u1', '555');
  });

  test('blocks at MAX_FOLLOWS_PER_CHAT', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta' });
    repo.getForUser.mockResolvedValue(null);
    repo.countByChat.mockResolvedValue(MAX_FOLLOWS_PER_CHAT);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.followTicket('u1', '555');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/máximo de 10/);
  });

  test('happy path upserts and calls rememberTicket', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta', partidoExtrado: 'Brasil vs Argentina' });
    repo.getForUser.mockResolvedValue(null);
    repo.countByChat.mockResolvedValue(0);
    const rememberTicket = jest.fn();
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo, rememberTicket });
    const r = await uc.followTicket('u1', '555', 'all_events');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/sigo tu ticket #555/);
    expect(r.message).toMatch(/Brasil vs Argentina/);
    expect(repo.upsertForUser).toHaveBeenCalledWith(555, 'u1', 'all_events', null);
    expect(rememberTicket).toHaveBeenCalledWith('u1', '555');
  });
});

describe('createFollowTicketUseCase.unfollowTicket', () => {
  test('rejects when not following', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue(null);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.unfollowTicket('u1', '555');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/No sigues el ticket/);
  });

  test('removes all modes and returns success', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.unfollowTicket('u1', '555');
    expect(r.ok).toBe(true);
    expect(repo.removeAllForUser).toHaveBeenCalledWith(555, 'u1');
  });
});

describe('createFollowTicketUseCase.listFollowed', () => {
  test('empty list returns help message', async () => {
    const repo = makeRepo();
    repo.listByChat.mockResolvedValue([]);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.listFollowed('u1');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/No sigues ningún ticket/);
  });

  test('lists followed tickets with summary', async () => {
    const repo = makeRepo();
    repo.listByChat.mockResolvedValue([
      { apuestaId: 555, chatId: 'u1', mode: 'all_events' },
      { apuestaId: 666, chatId: 'u1', mode: 'outcome_only' },
    ]);
    repo.getTicketSummary.mockImplementation((id) =>
      Promise.resolve({ id, idUsuario: 'u1', estado: 'abierta', partidoExtrado: `Team ${id}` })
    );
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.listFollowed('u1');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/#555/);
    expect(r.message).toMatch(/#666/);
    expect(r.message).toMatch(/outcome_only|sepas si ganaste|perdiste/);
    expect(r.message).toMatch(/Team 555/);
  });
});

describe('createFollowTicketUseCase.changeMode', () => {
  test('rejects invalid mode', async () => {
    const uc = createFollowTicketUseCase({ betFollowerRepository: makeRepo() });
    const r = await uc.changeMode('u1', '555', 'invalid_mode_xyz');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Modo inválido/);
  });

  test('rejects when not following', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue(null);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.changeMode('u1', '555', 'outcome_only');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/No sigues el ticket/);
  });

  test('returns no-op when already in target mode', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'outcome_only' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.changeMode('u1', '555', 'outcome_only');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/ya estaba en modo/);
    expect(repo.upsertForUser).not.toHaveBeenCalled();
  });

  test('switches modes correctly', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const r = await uc.changeMode('u1', '555', 'outcome_only');
    expect(r.ok).toBe(true);
    expect(repo.removeForUser).toHaveBeenCalledWith(555, 'u1', 'all_events');
    expect(repo.upsertForUser).toHaveBeenCalledWith(555, 'u1', 'outcome_only', null);
  });
});

describe('createFollowTicketUseCase — constructor', () => {
  test('throws if betFollowerRepository missing', () => {
    expect(() => createFollowTicketUseCase({})).toThrow(/betFollowerRepository is required/);
  });

  test('exports MAX_FOLLOWS_PER_CHAT and MODE_LABELS', () => {
    expect(MAX_FOLLOWS_PER_CHAT).toBe(10);
    expect(MODE_LABELS.all_events).toBeDefined();
    expect(MODE_LABELS.outcome_only).toBeDefined();
  });
});
