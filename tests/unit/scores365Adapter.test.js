/**
 * tests/unit/scores365Adapter.test.js — Verificación del adapter de formatters 365scores.
 */

const { createScores365Adapter, REQUIRED_METHODS } = require('../../src/application/scores365/scores365Adapter');

function makeService(overrides = {}) {
  const fn = jest.fn();
  return {
    COMPETITION_ID: 7,
    getTipPartido: fn, formatTipForGame: fn, getTendencias: fn,
    getTendenciasByTeams: fn, getLiveGames: fn, getStatsVivo: fn,
    getAlineacion: fn, getPrevia: fn, getH2H: fn, getPredicciones: fn,
    getFixture: fn, getOutrights: fn, getOdds: fn,
    ...overrides,
  };
}

describe('createScores365Adapter', () => {
  test('throws if module missing', () => {
    expect(() => createScores365Adapter(null)).toThrow(/legacyModule required/);
  });

  test('throws boot-time if any required method missing', () => {
    const svc = makeService();
    delete svc.getOdds;
    expect(() => createScores365Adapter(svc)).toThrow(/getOdds is not a function/);
  });

  test('throws at access time if method removed after boot (Proxy)', () => {
    const svc = makeService();
    const adapter = createScores365Adapter(svc);
    delete svc.getTipPartido;
    expect(() => adapter.getTipPartido('A', 'B')).toThrow(/is not implemented/);
  });

  test('passes through all required methods', () => {
    const svc = makeService({
      getTipPartido: jest.fn().mockReturnValue('TIP'),
      getLiveGames: jest.fn().mockReturnValue('LIVE'),
      getOdds: jest.fn().mockReturnValue('ODDS'),
    });
    const adapter = createScores365Adapter(svc);
    expect(adapter.getTipPartido('A', 'B')).toBe('TIP');
    expect(adapter.getLiveGames()).toBe('LIVE');
    expect(adapter.getOdds(123)).toBe('ODDS');
    expect(svc.getTipPartido).toHaveBeenCalledWith('A', 'B');
    expect(svc.getLiveGames).toHaveBeenCalled();
    expect(svc.getOdds).toHaveBeenCalledWith(123);
  });

  test('exposes COMPETITION_ID via Proxy', () => {
    const svc = makeService();
    svc.COMPETITION_ID = 42;
    const adapter = createScores365Adapter(svc);
    expect(adapter.COMPETITION_ID).toBe(42);
  });

  test('REQUIRED_METHODS has 13 entries', () => {
    expect(REQUIRED_METHODS.length).toBe(13);
    expect(REQUIRED_METHODS).toContain('getTipPartido');
    expect(REQUIRED_METHODS).toContain('getLiveGames');
    expect(REQUIRED_METHODS).toContain('getOdds');
  });
});