/**
 * Golden-master de `handleCommand` — comandos con datos (Fase 7, Fase 0).
 *
 * A diferencia de los de solo-texto, estos delegan en handlers/servicios
 * (`mundialista365Handler`, `scores365Service`, `matchSearch`). Los mockeamos
 * como jest.fn() programables por test, con datos canónicos fijos, y congelamos
 * el output EXACTO que el bot enviaría a Telegram (texto + teclados inline
 * construidos por el `buildGameKeyboard` real).
 *
 * El objetivo es capturar el comportamiento observable actual para que la
 * extracción a application/interface no lo altere.
 */

process.env.NODE_ENV = 'test';

jest.mock('https', () => require('./helpers/httpsCapture'));
const { reset, getSent } = require('./helpers/httpsCapture');

// Infra neutralizada (timers, conexiones, logs).
jest.mock('../utils/processGuard', () => ({ install: () => {} }));
jest.mock('../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {}, child() { return this; } }));
jest.mock('../database/connection', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  testConnection: jest.fn().mockResolvedValue(false),
}));
jest.mock('../handlers/messageHandler', () => jest.fn());
jest.mock('../handlers/followHandler', () => ({}));
jest.mock('../handlers/conversationalHandler', () => ({}));
jest.mock('../handlers/mundialistaStatsHandler', () => ({}));
jest.mock('../handlers/matchHandler', () => ({}));
jest.mock('../services/mundialCache', () => ({}));
jest.mock('../services/telegramNotifier', () => ({ registerBot() {}, attach() {} }));
jest.mock('../services/conversationContext', () => ({}));
jest.mock('../services/images', () => ({
  getAthletePhotoUrl: () => '', getAthleteThumbUrl: () => '',
  getCountryFlagUrl: () => '', getTeamBadgeUrl: () => '',
}));
jest.mock('../utils/userStorage', () => ({ getAlias: () => null, setAlias: jest.fn(), MAX_LEN: 20 }));

// Colaboradores de datos: programables por test.
jest.mock('../services/scores365Service', () => ({ getFixtures: jest.fn() }));
jest.mock('../services/matchSearch', () => ({ findLiveGames: jest.fn(), findGameByTeams: jest.fn() }));
jest.mock('../handlers/mundialista365Handler', () => ({
  COMPETITION_ID: 5930,
  getFixture: jest.fn(),
  getLiveGames: jest.fn(),
  getOutrights: jest.fn(),
  getTendencias: jest.fn(),
  getTendenciasByTeams: jest.fn(),
  getPredicciones: jest.fn(),
  getStatsVivo: jest.fn(),
  getOdds: jest.fn(),
}));

const scores365 = require('../services/scores365Service');
const matchSearch = require('../services/matchSearch');
const m365 = require('../handlers/mundialista365Handler');
const bot = require('../telegramBot');

const CHAT = 12345;
const USER = 999;

beforeEach(() => reset());

describe('handleCommand — comandos con datos (golden-master)', () => {
  test('/fixture con partidos futuros (teclado inline)', async () => {
    m365.getFixture.mockResolvedValue('📅 *FIXTURE DEL MUNDIAL*\n\nBrasil vs Argentina');
    scores365.getFixtures.mockResolvedValue({
      games: [
        { id: 111, startTime: '2099-01-01T18:00:00Z', homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Argentina' } },
      ],
    });
    const result = await bot.handleCommand(CHAT, '/fixture', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/live sin partidos en vivo (texto plano)', async () => {
    m365.getLiveGames.mockResolvedValue('📡 No hay partidos en vivo en este momento.');
    matchSearch.findLiveGames.mockResolvedValue([]);
    const result = await bot.handleCommand(CHAT, '/live', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/live con partidos en vivo (teclado stats+odds)', async () => {
    m365.getLiveGames.mockResolvedValue('📡 *EN VIVO*\n\nBrasil 1 - 0 Chile');
    matchSearch.findLiveGames.mockResolvedValue([
      { id: 222, homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Chile' } },
    ]);
    const result = await bot.handleCommand(CHAT, '/live', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/outrights (texto)', async () => {
    m365.getOutrights.mockResolvedValue('🎲 *CUOTAS OUTRIGHT*\n\nCampeón: Brasil 4.50');
    const result = await bot.handleCommand(CHAT, '/outrights', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/tendencias (top competición + outrights concatenados)', async () => {
    m365.getTendencias.mockResolvedValue('📊 *TENDENCIAS*\n\n1. Over 2.5 — 78%');
    m365.getOutrights.mockResolvedValue('🎲 Campeón: Brasil 4.50');
    const result = await bot.handleCommand(CHAT, '/tendencias', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/tendencias brasil vs argentina (por equipos + teclado si resuelve partido)', async () => {
    m365.getTendenciasByTeams.mockResolvedValue('📊 Brasil vs Argentina — Over 2.5 72%');
    matchSearch.findGameByTeams.mockResolvedValue({ id: 333 });
    const result = await bot.handleCommand(CHAT, '/tendencias brasil vs argentina', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/predicciones <gameId> (texto + teclado odds)', async () => {
    m365.getPredicciones.mockResolvedValue('🗳️ *PREDICCIONES*\n\nBrasil 55% / Empate 25% / Argentina 20%');
    const result = await bot.handleCommand(CHAT, '/predicciones 4749268', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/stats-vivo <gameId> (texto + teclado odds)', async () => {
    m365.getStatsVivo.mockResolvedValue('📊 *STATS EN VIVO*\n\nPosesión 60/40 — Tiros 8/3');
    const result = await bot.handleCommand(CHAT, '/stats-vivo 4749268', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/odds <gameId> (texto)', async () => {
    m365.getOdds.mockResolvedValue('🎲 *CUOTAS*\n\n1X2: 1.80 / 3.40 / 4.20');
    const result = await bot.handleCommand(CHAT, '/odds 4749268', 'Tester', USER);
    expect(result).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });
});
