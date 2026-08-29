/**
 * tests/unit/container.test.js — Post-T2.x
 *
 * Verifica que el composition root (src/infrastructure/container.js) cablea
 * correctamente los adaptadores, use-cases y command handlers.
 *
 * Estrategia: mockear todos los `deps` con stubs mínimos. Luego verificar
 * que las llamadas fluyen correctamente y los use-cases reciben sus deps.
 */

process.env.NODE_ENV = 'test';

// Mocks de use-cases y commands — stubs que sólo verifican que el
// container los cablea con las deps correctas.
const mockUseCases = {
  createGetLiveMatches: jest.fn(() => 'getLiveMatches-fn'),
  createGetFixture: jest.fn(() => 'getFixture-fn'),
  createMatchDetailUseCases: jest.fn(() => ({ detail: 'fn' })),
  createTrendsUseCases: jest.fn(() => ({ trends: 'fn' })),
  createContentUseCases: jest.fn(() => ({ content: 'fn' })),
};

const mockRouter = {
  register: jest.fn(),
  registerPrefix: jest.fn(),
  has: jest.fn(),
  dispatch: jest.fn(),
};
const mockCallbackDispatcher = jest.fn(() => jest.fn());

// Mocks de los módulos que el container importa.
jest.mock('../../src/interface/telegram/router', () => ({
  createRouter: () => mockRouter,
}));

jest.mock('../../src/infrastructure/scores365/scoresGateway', () => ({
  createScoresGateway: jest.fn(() => ({ __gateway: 'scores' })),
}));
jest.mock('../../src/infrastructure/content/contentGateway', () => ({
  createContentGateway: jest.fn(() => ({ __gateway: 'content' })),
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
  createHelpCommand: () => 'help-cmd',
}));
jest.mock('../../src/interface/telegram/commands/live', () => ({
  TRIGGERS: ['/live', '/partidos'],
  createLiveCommand: () => 'live-cmd',
}));
jest.mock('../../src/interface/telegram/commands/fixture', () => ({
  TRIGGERS: ['/fixture', '/calendario'],
  createFixtureCommand: () => 'fixture-cmd',
}));

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
      // Servicios legacy que el container pasa a use-cases/gateways.
      // Mundialista365 queda sólo como wrapper de formatters 365scores
      // (src/legacy/scores365-formatter.js — se elimina cuando se migren
      // los formatters al adapter de scores365UseCases).
      mundialista365: { __legacy: 'mundialista365' },
      matchSearch: { __legacy: 'matchSearch' },
      scores365: { __legacy: 'scores365' },
      cache: { __legacy: 'cache' },
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
    // Container hace 3 router.register(...) directos (help, live, fixture)
    // + 7 via register*Commands mockeados. Total: 10.
    const totalCalls = mockRouter.register.mock.calls.length;
    expect(totalCalls).toBeGreaterThanOrEqual(9);
    const calls = mockRouter.register.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('md-stub'))).toBe(true);
    expect(calls.some((c) => c.includes('help'))).toBe(true);
    expect(calls.some((c) => c.includes('live'))).toBe(true);
  });

  test('registra el dispatcher de callbacks', () => {
    const result = createContainer(makeDeps());
    expect(mockCallbackDispatcher).toHaveBeenCalledTimes(1);
    expect(mockCallbackDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        scoresGateway: expect.any(Object),
        cache: expect.any(Object),
        sendMessage: expect.any(Function),
      })
    );
    expect(typeof result.handleCallback).toBe('function');
  });

  test('pasar deps mínimos no lanza', () => {
    expect(() => createContainer({
      mundialista365: {},
      matchSearch: {},
      scores365: {},
      cache: {},
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
