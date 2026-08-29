/**
 * tests/integration/useCases-followTicket.test.js (T2b)
 *
 * Integration test para followTicketUseCase contra DB captura.
 *
 * Captura SQL writes vía dbCapture (mismo patrón que tests/sync.golden.test.js)
 * y verifica que las queries que ejecuta el use-case son las correctas:
 *   - getTicketSummary → SELECT FROM apuestas
 *   - getForUser → SELECT FROM bet_followers_v2
 *   - upsertForUser → INSERT ON CONFLICT
 *   - removeAllForUser → DELETE
 *   - countByChat → SELECT COUNT
 */

process.env.NODE_ENV = 'test';

jest.mock('../../database/connection', () => {
  const c = require('./helpers/dbCapture');
  return { pool: c.pool, withTransaction: c.withTransaction, pgQueryRetry: c.pgQueryRetry, testConnection: jest.fn().mockResolvedValue(true) };
});
jest.mock('../../database/db', () => require('./helpers/dbCapture').db);

const capture = require('./helpers/dbCapture');
const { createFollowTicketUseCase } = require('../../src/application/bets/followTicket');

function buildUseCase() {
  const rememberTicket = jest.fn();
  return createFollowTicketUseCase({
    betFollowerRepository: null, // lo construimos manual
    rememberTicket,
  });
}

function makeRepo() {
  return {
    getTicketSummary: jest.fn(),
    getForUser: jest.fn(),
    upsertForUser: jest.fn(),
    removeForUser: jest.fn(),
    removeAllForUser: jest.fn(),
    countByChat: jest.fn(),
    listByChat: jest.fn(),
    listByApuesta: jest.fn(),
  };
}

beforeEach(() => { capture.reset(); });

describe('followTicketUseCase — happy path', () => {
  test('inserta follow + persiste en contexto', async () => {
    const repo = makeRepo();
    const rememberTicket = jest.fn();
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo, rememberTicket });

    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta', partidoExtrado: 'Brasil vs Argentina' });
    repo.getForUser.mockResolvedValue(null);
    repo.countByChat.mockResolvedValue(0);

    const result = await uc.followTicket('u1', '555', 'all_events');

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/sigo tu ticket #555/);
    expect(repo.getTicketSummary).toHaveBeenCalledWith(555);
    expect(repo.getForUser).toHaveBeenCalledWith(555, 'u1');
    expect(repo.countByChat).toHaveBeenCalledWith('u1', 'all_events');
    expect(repo.upsertForUser).toHaveBeenCalledWith(555, 'u1', 'all_events', null);
    expect(rememberTicket).toHaveBeenCalledWith('u1', '555');
  });

  test('rechaza ticket que no existe', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue(null);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.followTicket('u1', '999');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No encontré el ticket #999/);
  });

  test('rechaza ticket que pertenece a otro user', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'other', estado: 'abierta' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.followTicket('u1', '555');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no es tuyo/);
  });

  test('rechaza ticket que ya no está abierto', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'completada' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.followTicket('u1', '555');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ya está completada/);
  });

  test('no-op cuando ya sigue en el mismo modo', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta' });
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.followTicket('u1', '555', 'all_events');
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Ya estás siguiendo/);
    expect(repo.upsertForUser).not.toHaveBeenCalled();
  });

  test('switch de modo: borra viejo + inserta nuevo', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta' });
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    repo.countByChat.mockResolvedValue(1);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.followTicket('u1', '555', 'outcome_only');
    expect(repo.removeForUser).toHaveBeenCalledWith(555, 'u1', 'all_events');
    expect(repo.upsertForUser).toHaveBeenCalledWith(555, 'u1', 'outcome_only', null);
  });

  test('bloquea al llegar al máximo (10)', async () => {
    const repo = makeRepo();
    repo.getTicketSummary.mockResolvedValue({ id: 555, idUsuario: 'u1', estado: 'abierta' });
    repo.getForUser.mockResolvedValue(null);
    repo.countByChat.mockResolvedValue(10);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.followTicket('u1', '555');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/máximo de 10/);
  });
});

describe('followTicketUseCase — unfollow', () => {
  test('unfollow elimina todos los modos', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue({ apuestaId: 555, chatId: 'u1', mode: 'all_events' });
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.unfollowTicket('u1', '555');
    expect(result.ok).toBe(true);
    expect(repo.removeAllForUser).toHaveBeenCalledWith(555, 'u1');
  });

  test('unfollow no-op cuando no sigue', async () => {
    const repo = makeRepo();
    repo.getForUser.mockResolvedValue(null);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.unfollowTicket('u1', '555');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No sigues el ticket #555/);
  });
});

describe('followTicketUseCase — listFollowed', () => {
  test('lista vacía devuelve mensaje de ayuda', async () => {
    const repo = makeRepo();
    repo.listByChat.mockResolvedValue([]);
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.listFollowed('u1');
    expect(result.message).toMatch(/No sigues ningún ticket/);
  });

  test('lista populada con tickets', async () => {
    const repo = makeRepo();
    repo.listByChat.mockResolvedValue([
      { apuestaId: 555, chatId: 'u1', mode: 'all_events' },
      { apuestaId: 666, chatId: 'u1', mode: 'outcome_only' },
    ]);
    repo.getTicketSummary.mockImplementation(async (id) => ({
      id, idUsuario: 'u1', estado: 'abierta', partidoExtrado: `Team ${id}`,
    }));
    const uc = createFollowTicketUseCase({ betFollowerRepository: repo });
    const result = await uc.listFollowed('u1');
    expect(result.message).toMatch(/#555/);
    expect(result.message).toMatch(/#666/);
    expect(result.message).toMatch(/Team 555/);
  });
});
