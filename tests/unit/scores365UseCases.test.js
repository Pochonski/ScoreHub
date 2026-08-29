/**
 * tests/unit/scores365UseCases.test.js — Verificación del use-case wrapper de 365scores (Fase 8).
 */

const { createScores365UseCases, REQUIRED_METHODS } = require('../../src/application/scores365/useCases');

function makeHandler(overrides = {}) {
  return {
    COMPETITION_ID: 7,
    fetchGameById: jest.fn(),
    formatTipForGame: jest.fn(),
    getTipPartido: jest.fn(),
    getTendencias: jest.fn(),
    getTendenciasByTeams: jest.fn(),
    getLiveGames: jest.fn(),
    getStatsVivo: jest.fn(),
    getAlineacion: jest.fn(),
    getPrevia: jest.fn(),
    getH2H: jest.fn(),
    getPredicciones: jest.fn(),
    getFixture: jest.fn(),
    getOutrights: jest.fn(),
    getOdds: jest.fn(),
    ...overrides,
  };
}

describe('createScores365UseCases', () => {
  test('throws if handler missing', () => {
    expect(() => createScores365UseCases({})).toThrow(/handler required/);
  });

  test('exposes all 15 required methods on the wrapper', () => {
    const handler = makeHandler();
    const uc = createScores365UseCases({ handler });
    REQUIRED_METHODS.forEach((m) => {
      expect(uc[m]).toBeDefined();
      if (m !== 'getCompetitionId' && m !== 'getCompetitions') {
        expect(typeof uc[m]).toBe('function');
      }
    });
  });

  test('each method delegates to the handler', async () => {
    const handler = makeHandler({
      fetchGameById: jest.fn().mockResolvedValue({ id: 1 }),
      getTipPartido: jest.fn().mockResolvedValue('TIP'),
      getLiveGames: jest.fn().mockReturnValue([]),
      getFixture: jest.fn().mockReturnValue('FIXTURE'),
    });
    const uc = createScores365UseCases({ handler });
    expect(await uc.fetchGameById(1)).toEqual({ id: 1 });
    expect(handler.fetchGameById).toHaveBeenCalledWith(1);
    expect(await uc.getTipPartido('A', 'B')).toBe('TIP');
    expect(handler.getTipPartido).toHaveBeenCalledWith('A', 'B');
    expect(uc.getLiveGames()).toEqual([]);
    expect(uc.getFixture()).toBe('FIXTURE');
  });

  test('getCompetitionId returns COMPETITION_ID', () => {
    const handler = makeHandler();
    handler.COMPETITION_ID = 99;
    const uc = createScores365UseCases({ handler });
    expect(uc.getCompetitionId()).toBe(99);
  });

  test('getCompetitions returns null until Fase 3 migrates', () => {
    const handler = makeHandler();
    const uc = createScores365UseCases({ handler });
    expect(uc.getCompetitions()).toBeNull();
  });

  test('throws on missing required method via Proxy', () => {
    const handler = makeHandler();
    delete handler.getLiveGames;
    const uc = createScores365UseCases({ handler });
    expect(() => uc.getLiveGames()).toThrow(/is not implemented/);
  });

  test('REQUIRED_METHODS is exported and has expected count', () => {
    expect(Array.isArray(REQUIRED_METHODS)).toBe(true);
    expect(REQUIRED_METHODS.length).toBeGreaterThanOrEqual(15);
    expect(REQUIRED_METHODS).toContain('getTipPartido');
    expect(REQUIRED_METHODS).toContain('getLiveGames');
    expect(REQUIRED_METHODS).toContain('getOutrights');
  });
});
