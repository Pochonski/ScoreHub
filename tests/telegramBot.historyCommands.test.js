/**
 * Golden-master de `handleCommand` — Historial/Jugadores/Contenido (Fase 7, Fase 0).
 *
 * Cubre /previa, /noticias, /equipoideal, /bracket, /historial, /goleadores,
 * /jugador, /h2h. Delegan en `mundialistaStatsHandler` / `mundialista365Handler`
 * (mockeados como jest.fn() programables) y en `mundialCache.searchAthletes` /
 * `scores365` para el perfil de jugador.
 *
 * En /jugador se fuerza `getAthleteNextGame` → { game: null } para evitar la
 * rama con toLocaleDateString (dependiente de locale/ICU); el resto del perfil
 * (eventos, foto) es determinista.
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
jest.mock('../handlers/messageHandler', () => jest.fn());
jest.mock('../handlers/followHandler', () => ({}));
jest.mock('../handlers/conversationalHandler', () => ({}));
jest.mock('../handlers/matchHandler', () => ({}));
jest.mock('../services/matchSearch', () => ({}));
jest.mock('../services/telegramNotifier', () => ({ registerBot() {}, attach() {} }));
jest.mock('../services/conversationContext', () => ({}));
jest.mock('../utils/userStorage', () => ({ getAlias: () => null, setAlias: jest.fn(), MAX_LEN: 20 }));
jest.mock('../services/images', () => ({
  getAthletePhotoUrl: () => 'https://img.test/athlete.png',
  getAthleteThumbUrl: () => '', getCountryFlagUrl: () => '', getTeamBadgeUrl: () => '',
}));

jest.mock('../handlers/mundialistaStatsHandler', () => ({
  getNoticias: jest.fn(),
  getEquipoIdeal: jest.fn(),
  getBracket: jest.fn(),
  getHistorial: jest.fn(),
  getGoleadores: jest.fn(),
}));
jest.mock('../handlers/mundialista365Handler', () => ({
  getPrevia: jest.fn(),
  getH2H: jest.fn(),
  getOutrights: jest.fn(),
}));
jest.mock('../services/mundialCache', () => ({ searchAthletes: jest.fn() }));
jest.mock('../services/scores365Service', () => ({
  getAthleteNextGame: jest.fn(),
  getAthleteChartEvents: jest.fn(),
}));

const stats = require('../handlers/mundialistaStatsHandler');
const m365 = require('../handlers/mundialista365Handler');
const cache = require('../services/mundialCache');
const scores365 = require('../services/scores365Service');
const bot = require('../telegramBot');

const CHAT = 12345;
const USER = 999;

beforeEach(() => reset());

describe('handleCommand — Historial/Jugadores (golden-master)', () => {
  test('/previa sin argumento (usage)', async () => {
    expect(await bot.handleCommand(CHAT, '/previa', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/previa <gameId> (texto + teclado lineup/h2h/odds)', async () => {
    m365.getPrevia.mockResolvedValue('🔮 *PREVIA*\n\nBrasil llega con 4 victorias.');
    expect(await bot.handleCommand(CHAT, '/previa 4749268', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/noticias (top, equipo null)', async () => {
    stats.getNoticias.mockResolvedValue('📰 *NOTICIAS*\n\n1. Título de prueba');
    expect(await bot.handleCommand(CHAT, '/noticias', 'Tester', USER)).toBe(true);
    expect(stats.getNoticias.mock.calls[0][0]).toEqual({ equipo: null, limit: 10 });
    expect(getSent()).toMatchSnapshot();
  });

  test('/noticias brasil (equipo="brasil")', async () => {
    stats.getNoticias.mockResolvedValue('📰 *NOTICIAS - BRASIL*\n\n1. Título');
    expect(await bot.handleCommand(CHAT, '/noticias brasil', 'Tester', USER)).toBe(true);
    expect(stats.getNoticias.mock.calls[0][0]).toEqual({ equipo: 'brasil', limit: 10 });
    expect(getSent()).toMatchSnapshot();
  });

  test('/equipoideal', async () => {
    stats.getEquipoIdeal.mockResolvedValue('⭐ *EQUIPO IDEAL*\n\nGK: ...');
    expect(await bot.handleCommand(CHAT, '/equipoideal', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/bracket (eliminatorias)', async () => {
    stats.getBracket.mockResolvedValue('🏆 *LLAVES*\n\nOctavos: ...');
    expect(await bot.handleCommand(CHAT, '/bracket', 'Tester', USER)).toBe(true);
    expect(stats.getBracket.mock.calls[0][0]).toBe('eliminatorias');
    expect(getSent()).toMatchSnapshot();
  });

  test('/bracket grupos', async () => {
    stats.getBracket.mockResolvedValue('🏆 *FASE DE GRUPOS*\n\nGrupo A: ...');
    expect(await bot.handleCommand(CHAT, '/bracket grupos', 'Tester', USER)).toBe(true);
    expect(stats.getBracket.mock.calls[0][0]).toBe('grupos');
    expect(getSent()).toMatchSnapshot();
  });

  test('/historial (todos los campeones)', async () => {
    stats.getHistorial.mockResolvedValue('📜 *CAMPEONES*\n\n2022 Argentina...');
    expect(await bot.handleCommand(CHAT, '/historial', 'Tester', USER)).toBe(true);
    expect(stats.getHistorial.mock.calls[0][0]).toBeNull();
    expect(getSent()).toMatchSnapshot();
  });

  test('/historial 2022 (por año)', async () => {
    stats.getHistorial.mockResolvedValue('📜 *FINAL 2022*\n\nArgentina 3-3 Francia (pen)');
    expect(await bot.handleCommand(CHAT, '/historial 2022', 'Tester', USER)).toBe(true);
    expect(stats.getHistorial.mock.calls[0][0]).toBe('2022');
    expect(getSent()).toMatchSnapshot();
  });

  test('/goleadores con foto + outrights', async () => {
    stats.getGoleadores.mockResolvedValue({ photoUrl: 'https://img.test/scorer.png', text: '👟 *GOLEADORES*\n\n1. Mbappé — 8' });
    m365.getOutrights.mockResolvedValue('🎲 Bota de oro: Mbappé 3.5');
    expect(await bot.handleCommand(CHAT, '/goleadores', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/goleadores sin foto (texto plano)', async () => {
    stats.getGoleadores.mockResolvedValue({ photoUrl: null, text: '👟 *GOLEADORES*\n\n1. Mbappé — 8' });
    m365.getOutrights.mockResolvedValue('🎲 Bota de oro: Mbappé 3.5');
    expect(await bot.handleCommand(CHAT, '/goleadores', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/jugador mbappe (foto + eventos)', async () => {
    cache.searchAthletes.mockResolvedValue([
      { id: 12994, name: 'Kylian Mbappé', position: { name: 'Delantero' }, age: 26 },
    ]);
    scores365.getAthleteNextGame.mockResolvedValue({ game: null });
    scores365.getAthleteChartEvents.mockResolvedValue({ events: [{ type: 'goal' }, { type: 'yellow' }, { type: 'assist' }] });
    expect(await bot.handleCommand(CHAT, '/jugador mbappe', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/jugador sin argumento (usage)', async () => {
    expect(await bot.handleCommand(CHAT, '/jugador', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/h2h sin argumento (usage)', async () => {
    expect(await bot.handleCommand(CHAT, '/h2h', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });

  test('/h2h <gameId> (texto + teclado previa/odds)', async () => {
    m365.getH2H.mockResolvedValue('🤝 *H2H*\n\nBrasil 3 - 1 Serbia (histórico)');
    expect(await bot.handleCommand(CHAT, '/h2h 4749268', 'Tester', USER)).toBe(true);
    expect(getSent()).toMatchSnapshot();
  });
});
