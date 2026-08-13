/**
 * tests/unit/container.test.js — Auditoría 2026-Q3 Fase 8.6
 *
 * Verifica que el composition root (src/infrastructure/container.js) cablea
 * correctamente los adaptadores, use-cases y command handlers.
 *
 * Estrategia: mockear todos los `deps` con stubs mínimos que capturen las
 * llamadas. Luego verificar que las llamadas fluyen correctamente.
 */

process.env.NODE_ENV = 'test';

// Mockear los gateways legacy — usamos stubs en vez de los reales porque
// tienen side effects (DB, HTTP, etc).
const mockUseCases = {
  createGetLiveMatches: jest.fn(() => 'getLiveMatches-fn'),
  createGetFixture: jest.fn(() => 'getFixture-fn'),
  createMatchDetailUseCases: jest.fn(() => ({ detail: 'fn' })),
  createTrendsUseCases: jest.fn(() => ({ trends: 'fn' })),
  createContentUseCases: jest.fn(() => ({ content: 'fn' })),
};
const mockHelpCmd = jest.fn(() => 'help-cmd');
const mockLiveCmd = jest.fn(() => 'live-cmd');
const mockFixtureCmd = jest.fn(() => 'fixture-cmd');
const mockRegisterMatchDetail = jest.fn();
const mockRegisterTrends = jest.fn();
const mockRegisterContent = jest.fn();
const mockRegisterTeams = jest.fn();
const mockRegisterProfile = jest.fn();
const mockRegisterMatchData = jest.fn();
const mockRegisterPlayers = jest.fn();
const mockCallbackDispatcher = jest.fn(() => jest.fn());
const mockRouter = {
  register: jest.fn(),
  registerPrefix: jest.fn(),
  has: jest.fn(),
  dispatch: jest.fn(),
};

// Mockear todos los módulos que el container importa, antes del require del container.
jest.mock('../../src/interface/telegram/router', () => ({
  createRouter: () => mockRouter,
}));

jest.mock('../../src/infrastructure/scores365/scoresGateway', () => ({
  createScoresGateway: jest.fn(() => ({ __gateway: 'scores' })),
}));
jest.mock('../../src/infrastructure/content/contentGateway', () => ({
  createContentGateway: jest.fn(() => ({ __gateway: 'content' })),
}));
jest.mock('../../src/infrastructure/nlu/messageHandlerGateway', () => ({
  createMessageHandlerGateway: jest.fn(() => ({ __gateway: 'nlu' })),
}));
jest.mock('../../src/interface/telegram/callbacks', () => ({
  createCallbackDispatcher: mockCallbackDispatcher,
}));
jest.mock('../../src/interface/telegram/presenters/keyboards', () => ({
  buildGameKeyboard: jest.fn(),
  buildSingleGameKeyboard: jest.fn(),
}));

jest.mock('../../src/application/matches/getLiveMatches', () => ({
  createGetLiveMatches: mockUseCases.createGetLiveMatches,
}));
jest.mock('../../src/application/matches/getFixture', () => ({
  createGetFixture: mockUseCases.createGetFixture,
}));
jest.mock('../../src/application/matches/matchDetail', () => ({
  createMatchDetailUseCases: mockUseCases.createMatchDetailUseCases,
}));
jest.mock('../../src/application/matches/trends', () => ({
  createTrendsUseCases: mockUseCases.createTrendsUseCases,
}));
jest.mock('../../src/application/content/contentUseCases', () => ({
  createContentUseCases: mockUseCases.createContentUseCases,
}));

jest.mock('../../src/interface/telegram/commands/help', () => ({
  TRIGGERS: ['/help', '/ayuda'],
  createHelpCommand: () => mockHelpCmd,
}));
jest.mock('../../src/interface/telegram/commands/live', () => ({
  TRIGGERS: ['/live', '/partidos'],
  createLiveCommand: () => mockLiveCmd,
}));
jest.mock('../../src/interface/telegram/commands/fixture', () => ({
  TRIGGERS: ['/fixture', '/calendario'],
  createFixtureCommand: () => mockFixtureCmd,
}));
// Auditoría 2026-Q3 Fase 8.6: los mocks de register*Commands simulan lo
// que harían los reales — llamar router.register(...) para registrar comandos.
// (Jest requiere que el factory esté prefijado con `mock` para acceder desde jest.mock.)
const mockMakeRegistrator = (stubTrigger) => (router, deps) => {
  router.register([stubTrigger], jest.fn());
};
jest.mock('../../src/interface/telegram/commands/matchDetail', () => ({
  registerMatchDetailCommands: mockMakeRegistrator('/md-stub'),
}));
jest.mock('../../src/interface/telegram/commands/trends', () => ({
  registerTrendsCommands: mockMakeRegistrator('/trends-stub'),
}));
jest.mock('../../src/interface/telegram/commands/content', () => ({
  registerContentCommands: mockMakeRegistrator('/content-stub'),
}));
jest.mock('../../src/interface/telegram/commands/teams', () => ({
  registerTeamsCommands: mockMakeRegistrator('/teams-stub'),
}));
jest.mock('../../src/interface/telegram/commands/profile', () => ({
  registerProfileCommands: mockMakeRegistrator('/profile-stub'),
}));
jest.mock('../../src/interface/telegram/commands/matchData', () => ({
  registerMatchDataCommands: mockMakeRegistrator('/matchdata-stub'),
}));
jest.mock('../../src/interface/telegram/commands/players', () => ({
  registerPlayerCommands: mockMakeRegistrator('/players-stub'),
}));

const { createContainer } = require('../../src/infrastructure/container');

describe('createContainer — composition root del bot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeDeps() {
    return {
      // Legacy handlers (stubs)
      mundialista365: { __legacy: 'mundialista365' },
      mundialistaStats: { __legacy: 'mundialistaStats' },
      matchSearch: { __legacy: 'matchSearch' },
      scores365: { __legacy: 'scores365' },
      matchHandler: { __legacy: 'matchHandler' },
      cache: { __legacy: 'cache' },
      messageHandler: { __legacy: 'messageHandler' },
      userStorage: { __legacy: 'userStorage' },
      pool: { __legacy: 'pool' },
      // Telegram transport
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendPhoto: jest.fn().mockResolvedValue(undefined),
      sendMediaGroup: jest.fn().mockResolvedValue(undefined),
      // Images
      getTeamBadgeUrl: jest.fn(() => 'badge'),
      getCountryFlagUrl: jest.fn(() => 'flag'),
      getAthletePhotoUrl: jest.fn(() => 'photo'),
      getAthleteThumbUrl: jest.fn(() => 'thumb'),
    };
  }

  test('retorna { router, handleCallback }', () => {
    const result = createContainer(makeDeps());
    expect(result).toHaveProperty('router');
    expect(result).toHaveProperty('handleCallback');
    expect(typeof result.handleCallback).toBe('function');
  });

  test('cablea use cases con los gateways', () => {
    createContainer(makeDeps());

    // Cada use case recibe un gateway (o un gateway + contentGateway).
    expect(mockUseCases.createGetLiveMatches).toHaveBeenCalledTimes(1);
    expect(mockUseCases.createGetLiveMatches).toHaveBeenCalledWith(
      expect.objectContaining({ scoresGateway: expect.any(Object) })
    );
    expect(mockUseCases.createGetFixture).toHaveBeenCalledWith(
      expect.objectContaining({ scoresGateway: expect.any(Object) })
    );
    expect(mockUseCases.createMatchDetailUseCases).toHaveBeenCalledWith(
      expect.objectContaining({ scoresGateway: expect.any(Object) })
    );
    expect(mockUseCases.createTrendsUseCases).toHaveBeenCalledWith(
      expect.objectContaining({ scoresGateway: expect.any(Object) })
    );
    expect(mockUseCases.createContentUseCases).toHaveBeenCalledWith(
      expect.objectContaining({ contentGateway: expect.any(Object) })
    );
  });

  test('registra todos los command handlers en el router', () => {
    createContainer(makeDeps());
    // El container invoca router.register(...) 3 veces directo + 7 comandos
    // via register*Commands (mockMakeRegistrator). Total: 10 (3 + 7).
    // Si cambia la cantidad de comandos, este número refleja los stubs.
    const totalCalls = mockRouter.register.mock.calls.length;
    expect(totalCalls).toBeGreaterThanOrEqual(9);
    // Verificar que los stubs marker son visibles.
    const calls = mockRouter.register.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('md-stub'))).toBe(true);
    expect(calls.some((c) => c.includes('help'))).toBe(true);
    expect(calls.some((c) => c.includes('live'))).toBe(true);
  });

  test('registra el dispatcher de callbacks', () => {
    const result = createContainer(makeDeps());
    expect(mockCallbackDispatcher).toHaveBeenCalledTimes(1);
    expect(mockCallbackDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({ scoresGateway: expect.any(Object), cache: expect.any(Object), sendMessage: expect.any(Function) })
    );
    expect(typeof result.handleCallback).toBe('function');
  });

  test('pasar deps mínimos no lanza', () => {
    // Container sólo usa algunas keys — el resto son opcionales para los
    // command handlers que no se inyectan.
    expect(() => createContainer({
      mundialista365: {},
      mundialistaStats: {},
      matchSearch: {},
      scores365: {},
      matchHandler: {},
      cache: {},
      messageHandler: {},
      userStorage: {},
      pool: {},
      sendMessage: () => {},
      sendPhoto: () => {},
      sendMediaGroup: () => {},
      getTeamBadgeUrl: () => '',
      getCountryFlagUrl: () => '',
      getAthletePhotoUrl: () => '',
      getAthleteThumbUrl: () => '',
    })).not.toThrow();
  });
});