/**
 * Golden-master (characterization) de `handleCommand` — Fase 7.
 *
 * Congela el output EXACTO del bot (método + params que enviaría a Telegram)
 * para comandos de solo-texto. Cualquier extracción posterior de la Fase 7 que
 * cambie el comportamiento observable rompe estos snapshots. Es la red de
 * seguridad que habilita el refactor.
 *
 * Empezamos por los comandos sin dependencias de datos (`/start`, `/help`);
 * los lotes con servicios se agregan en tests hermanos a medida que avanza el
 * strangler (ver docs/refactor-plans/07-clean-architecture-backend.md § Fase 0).
 */

process.env.NODE_ENV = 'test';

// Transporte: captura lo que el bot enviaría a Telegram (sin red).
jest.mock('https', () => require('./helpers/httpsCapture'));
const { reset, getSent } = require('./helpers/httpsCapture');

// Neutralizar colaboradores con efectos de carga (timers, conexiones, logs).
jest.mock('../utils/processGuard', () => ({ install: () => {} }));
jest.mock('../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../database/connection', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  testConnection: jest.fn().mockResolvedValue(false),
}));
jest.mock('../handlers/messageHandler', () => jest.fn());
jest.mock('../services/matchSearch', () => ({}));
jest.mock('../services/scores365Service', () => ({}));
jest.mock('../handlers/followHandler', () => ({}));
jest.mock('../handlers/conversationalHandler', () => ({}));
jest.mock('../handlers/mundialista365Handler', () => ({}));
jest.mock('../handlers/mundialistaStatsHandler', () => ({}));
jest.mock('../services/mundialCache', () => ({}));
jest.mock('../handlers/matchHandler', () => ({}));
jest.mock('../services/images', () => ({
  getAthletePhotoUrl: () => '', getAthleteThumbUrl: () => '',
  getCountryFlagUrl: () => '', getTeamBadgeUrl: () => '',
}));
jest.mock('../services/telegramNotifier', () => ({ registerBot() {}, attach() {} }));
jest.mock('../services/conversationContext', () => ({}));
// getAlias determinista (null) → el alias cae a userName ('Tester'), snapshot estable.
jest.mock('../utils/userStorage', () => ({
  getAlias: () => null,
  setAlias: jest.fn(),
  MAX_LEN: 20,
}));

const bot = require('../telegramBot');

beforeEach(() => reset());

describe('handleCommand — comandos de solo-texto (golden-master)', () => {
  const CHAT = 12345;
  const USER = 999;

  test('/start', async () => {
    const result = await bot.handleCommand(CHAT, '/start', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/help', async () => {
    const result = await bot.handleCommand(CHAT, '/help', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  // Fase 7: el router normaliza @botmundialistabot de forma uniforme, así que
  // /help@botmundialistabot rutea igual que /help (el legacy no lo atendía).
  test('/help@botmundialistabot rutea idéntico a /help', async () => {
    await bot.handleCommand(CHAT, '/help@botmundialistabot', 'Tester', USER);
    const withSuffix = getSent();
    reset();
    await bot.handleCommand(CHAT, '/help', 'Tester', USER);
    const plain = getSent();
    expect(withSuffix).toEqual(plain);
    expect(withSuffix.length).toBe(1);
  });

  // Usage prompts (sin argumento): texto puro, sin dependencias de datos.
  test.each([
    ['/tip'],
    ['/odds'],
    ['/stats-vivo'],
    ['/predicciones'],
    ['/alineacion'],
  ])('%s sin argumento (usage prompt)', async (command) => {
    const result = await bot.handleCommand(CHAT, command, 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });
});
