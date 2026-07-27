/**
 * Golden-master de `handleCommand` — Follow/Equipos (Fase 7, Fase 0).
 *
 * Estos comandos (`/seguir`, `/dejarseguir`, `/misfavoritos`, `/info`, `/grupo`)
 * delegan en el `messageHandler` (ruta de lenguaje natural) construyendo un
 * mensaje falso `{ from, body, reply }`. El `body` que arman es parte del
 * contrato observable: lo congelamos con un assert sobre la llamada al
 * messageHandler, además del snapshot del output.
 *
 * `/dondever` es inline (usa `mundialCache`). Se cubren sus ramas deterministas
 * (equipo no encontrado / sin próximos); la rama con fecha usa toLocaleDateString
 * y se omite acá por depender del locale/ICU del entorno.
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
jest.mock('../handlers/followHandler', () => ({}));
jest.mock('../handlers/conversationalHandler', () => ({}));
jest.mock('../handlers/mundialista365Handler', () => ({}));
jest.mock('../handlers/mundialistaStatsHandler', () => ({}));
jest.mock('../handlers/matchHandler', () => ({}));
jest.mock('../services/telegramNotifier', () => ({ registerBot() {}, attach() {} }));
jest.mock('../services/conversationContext', () => ({}));
jest.mock('../utils/userStorage', () => ({ getAlias: () => null, setAlias: jest.fn(), MAX_LEN: 20 }));
jest.mock('../services/images', () => ({
  getAthletePhotoUrl: () => '', getAthleteThumbUrl: () => '',
  getCountryFlagUrl: () => 'https://img.test/flag.png',
  getTeamBadgeUrl: () => 'https://img.test/badge.png',
}));

// Colaboradores con comportamiento programable.
jest.mock('../handlers/messageHandler', () => jest.fn());
jest.mock('../services/mundialCache', () => ({
  getTeamByName: jest.fn(),
  getRecentWorldCupMatchesByTeam: jest.fn(),
  getWorldCupStandings: jest.fn(),
}));

const messageHandler = require('../handlers/messageHandler');
const cache = require('../services/mundialCache');
const bot = require('../telegramBot');

const CHAT = 12345;
const USER = 999;

// messageHandler por defecto responde vía msg.reply (como haría el real).
function replyWith(text) {
  messageHandler.mockImplementation(async (_client, msg) => { await msg.reply(text); });
}

beforeEach(() => {
  reset();
  cache.getTeamByName.mockReset();
  cache.getRecentWorldCupMatchesByTeam.mockReset();
  cache.getWorldCupStandings.mockReset();
  messageHandler.mockReset();
});

describe('handleCommand — Follow/Equipos (golden-master)', () => {
  test('/dejarseguir sin argumento (usage)', async () => {
    const result = await bot.handleCommand(CHAT, '/dejarseguir', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/dejarseguir brasil (delega body "dejar de seguir brasil")', async () => {
    replyWith('🚫 Dejaste de seguir a Brasil.');
    const result = await bot.handleCommand(CHAT, '/dejarseguir brasil', 'Tester', USER);
    expect(result).toBe(true);
    expect(messageHandler.mock.calls[0][1].body).toBe('dejar de seguir brasil');
    expect(getSent()).toMatchSnapshot();
  });

  test('/misfavoritos (delega body "mis equipos")', async () => {
    replyWith('⭐ Tus equipos: Brasil, Argentina');
    const result = await bot.handleCommand(CHAT, '/misfavoritos', 'Tester', USER);
    expect(result).toBe(true);
    expect(messageHandler.mock.calls[0][1].body).toBe('mis equipos');
    expect(getSent()).toMatchSnapshot();
  });

  test('/info brasil (delega + sendPhoto + teclado próximo partido)', async () => {
    replyWith('🇧🇷 *BRASIL*\n\n5 veces campeón del mundo.');
    cache.getTeamByName.mockResolvedValue({ id: 4, name: 'Brasil', countryId: 1, imageVersion: 2 });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([
      { id: 555, startTime: '2099-06-01T18:00:00Z', homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Serbia' } },
    ]);
    const result = await bot.handleCommand(CHAT, '/info brasil', 'Tester', USER);
    expect(result).toBe(true);
    expect(messageHandler.mock.calls[0][1].body).toBe('dame info de brasil');
    expect(getSent()).toMatchSnapshot();
  });

  test('/seguir brasil (delega body "seguir brasil" + teclado próximos)', async () => {
    replyWith('✅ Ahora seguís a *Brasil*.');
    cache.getTeamByName.mockResolvedValue({ id: 4, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([
      { id: 601, startTime: '2099-06-01T18:00:00Z', homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Serbia' } },
      { id: 602, startTime: '2099-06-06T18:00:00Z', homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Suiza' } },
    ]);
    const result = await bot.handleCommand(CHAT, '/seguir brasil', 'Tester', USER);
    expect(result).toBe(true);
    expect(messageHandler.mock.calls[0][1].body).toBe('seguir brasil');
    expect(getSent()).toMatchSnapshot();
  });

  test('/grupo A (delega body "tabla grupo A", sin media group)', async () => {
    replyWith('🏆 *GRUPO A*\n\n1. Brasil 9 pts');
    cache.getWorldCupStandings.mockResolvedValue([]); // sin match → solo la reply
    const result = await bot.handleCommand(CHAT, '/grupo a', 'Tester', USER);
    expect(result).toBe(true);
    expect(messageHandler.mock.calls[0][1].body).toBe('tabla grupo A');
    expect(getSent()).toMatchSnapshot();
  });

  test('/dondever sin argumento (usage)', async () => {
    const result = await bot.handleCommand(CHAT, '/dondever', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/dondever brasil — equipo no encontrado', async () => {
    cache.getTeamByName.mockResolvedValue(null);
    const result = await bot.handleCommand(CHAT, '/dondever brasil', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/dondever brasil — sin próximos partidos', async () => {
    cache.getTeamByName.mockResolvedValue({ id: 4, name: 'Brasil' });
    cache.getRecentWorldCupMatchesByTeam.mockResolvedValue([]);
    const result = await bot.handleCommand(CHAT, '/dondever brasil', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });
});
