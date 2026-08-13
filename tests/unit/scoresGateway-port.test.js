/**
 * tests/unit/scoresGateway-port.test.js — Auditoría 2026-Q3 Fase 3.1
 *
 * Tests de la factory tipada `createScoresGateway`. Verifica:
 * - Adapter completo pasa el Proxy sin lanzar.
 * - Adapter sin un método required lanza `not implemented` al acceder.
 * - Adapter con método extra no rompe.
 * - `competitionId` getter se respeta.
 */

process.env.NODE_ENV = 'test';

const { createScoresGateway, REQUIRED_METHODS } = require('../../src/domain/ports/scoresGateway');

function makeFullAdapter() {
  const adapter = {};
  for (const m of REQUIRED_METHODS) adapter[m] = () => `mock-${m}`;
  adapter.competitionId = 5930;
  return adapter;
}

describe('createScoresGateway — factory tipada', () => {
  test('adapter completo → acceso a cada método retorna la función', () => {
    const gw = createScoresGateway(makeFullAdapter());
    expect(typeof gw.getLiveGamesText).toBe('function');
    expect(typeof gw.findGame).toBe('function');
    expect(gw.competitionId).toBe(5930);
  });

  test('adapter sin un método required → lanza "not implemented" al acceder', () => {
    const adapter = makeFullAdapter();
    delete adapter.findGame;
    const gw = createScoresGateway(adapter);
    expect(() => gw.findGame()).toThrow(/findGame is not implemented/);
  });

  test('adapter vacío → todos los métodos lanzan', () => {
    const gw = createScoresGateway({});
    for (const m of REQUIRED_METHODS) {
      expect(() => gw[m]()).toThrow(new RegExp(`${m} is not implemented`));
    }
  });

  test('adapter con método extra → no rompe el Proxy', () => {
    const adapter = makeFullAdapter();
    adapter.extraMethod = () => 'extra';
    const gw = createScoresGateway(adapter);
    expect(gw.extraMethod()).toBe('extra');
  });

  test('adapter inválido (null) → lanza error inmediato', () => {
    expect(() => createScoresGateway(null)).toThrow(/adapter must be an object/);
  });

  test('competitionId es accesible sin ser método', () => {
    const gw = createScoresGateway({ ...makeFullAdapter(), competitionId: 1234 });
    expect(gw.competitionId).toBe(1234);
  });

  test('REQUIRED_METHODS exportado y no vacío', () => {
    expect(Array.isArray(REQUIRED_METHODS)).toBe(true);
    expect(REQUIRED_METHODS.length).toBeGreaterThan(5);
  });
});