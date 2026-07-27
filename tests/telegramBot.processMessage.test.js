/**
 * Golden-master de `processMessage` — router de entrada (Fase 7, Fase 0).
 *
 * `processMessage` es el punto de entrada que la Fase 2 convierte en el router:
 *   - comandos de apuestas (`/follow`, `/unfollow`, `/misapuestas`) → followHandler
 *   - texto libre → conversationalHandler.handleMessage (y fallback a messageHandler)
 *   - comando desconocido con resto de texto → messageHandler con el texto sin comando
 *
 * Congelamos ese ruteo y los contratos (a qué colaborador va cada input, con qué
 * argumentos), además del output enviado.
 */

process.env.NODE_ENV = 'test';

jest.mock('https', () => require('./helpers/httpsCapture'));
const { reset, getSent } = require('./helpers/httpsCapture');

jest.mock('../utils/processGuard', () => ({ install: () => {} }));
jest.mock('../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../database/connection', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  testConnection: jest.fn().mockResolvedValue(false),
}));
jest.mock('../services/matchSearch', () => ({}));
jest.mock('../services/scores365Service', () => ({}));
jest.mock('../services/mundialCache', () => ({}));
jest.mock('../handlers/mundialista365Handler', () => ({}));
jest.mock('../handlers/mundialistaStatsHandler', () => ({}));
jest.mock('../handlers/matchHandler', () => ({}));
jest.mock('../services/telegramNotifier', () => ({ registerBot() {}, attach() {} }));
jest.mock('../services/conversationContext', () => ({}));
jest.mock('../utils/userStorage', () => ({ getAlias: () => null, setAlias: jest.fn(), MAX_LEN: 20 }));
jest.mock('../services/images', () => ({
  getAthletePhotoUrl: () => '', getAthleteThumbUrl: () => '',
  getCountryFlagUrl: () => '', getTeamBadgeUrl: () => '',
}));

jest.mock('../handlers/messageHandler', () => jest.fn());
jest.mock('../handlers/followHandler', () => ({
  handleFollowCommand: jest.fn(),
  handleUnfollowCommand: jest.fn(),
  handleListCommand: jest.fn(),
}));
jest.mock('../handlers/conversationalHandler', () => ({ handleMessage: jest.fn() }));

const messageHandler = require('../handlers/messageHandler');
const followHandler = require('../handlers/followHandler');
const conversational = require('../handlers/conversationalHandler');
const bot = require('../telegramBot');

const CHAT = 12345;
const USER = 999;

beforeEach(() => reset());

describe('processMessage — router de entrada (golden-master)', () => {
  test('/follow <ticket> → followHandler.handleFollowCommand', async () => {
    followHandler.handleFollowCommand.mockResolvedValue({ message: '✅ Siguiendo el ticket 12345.' });
    await bot.processMessage(CHAT, USER, '/follow 12345', 'Tester');
    expect(followHandler.handleFollowCommand).toHaveBeenCalledWith('999', '12345');
    expect(getSent()).toMatchSnapshot();
  });

  test('/misapuestas → followHandler.handleListCommand', async () => {
    followHandler.handleListCommand.mockResolvedValue({ message: '📋 No seguís ningún ticket.' });
    await bot.processMessage(CHAT, USER, '/misapuestas', 'Tester');
    expect(followHandler.handleListCommand).toHaveBeenCalledWith('999');
    expect(getSent()).toMatchSnapshot();
  });

  test('texto libre resuelto por conversationalHandler', async () => {
    conversational.handleMessage.mockResolvedValue({ handled: true, message: '🇧🇷 Brasil ganó 2-0.' });
    await bot.processMessage(CHAT, USER, '¿Cómo quedó Brasil?', 'Tester');
    expect(conversational.handleMessage).toHaveBeenCalledWith('999', '¿Cómo quedó Brasil?');
    expect(messageHandler).not.toHaveBeenCalled();
    expect(getSent()).toMatchSnapshot();
  });

  test('texto libre NO resuelto por conversational → fallback a messageHandler', async () => {
    conversational.handleMessage.mockResolvedValue({ handled: false });
    messageHandler.mockImplementation(async (_c, msg) => { await msg.reply('🤖 Respuesta del messageHandler.'); });
    await bot.processMessage(CHAT, USER, 'dame algo raro', 'Tester');
    expect(messageHandler.mock.calls[0][1].body).toBe('dame algo raro');
    expect(getSent()).toMatchSnapshot();
  });

  test('comando desconocido con resto → messageHandler con texto sin comando', async () => {
    messageHandler.mockImplementation(async (_c, msg) => { await msg.reply('🤖 ok'); });
    await bot.processMessage(CHAT, USER, '/desconocido hola mundo', 'Tester');
    expect(messageHandler.mock.calls[0][1].body).toBe('hola mundo');
    expect(getSent()).toMatchSnapshot();
  });
});
