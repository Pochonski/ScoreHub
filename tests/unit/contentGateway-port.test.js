/**
 * tests/unit/contentGateway-port.test.js — Auditoría 2026-Q3 Fase 3.2
 *
 * Tests de la factory tipada `createContentGateway`.
 */

process.env.NODE_ENV = 'test';

const { createContentGateway, REQUIRED_METHODS } = require('../../src/domain/ports/contentGateway');

function makeFullAdapter() {
  const adapter = {};
  for (const m of REQUIRED_METHODS) adapter[m] = () => `mock-${m}`;
  return adapter;
}

describe('createContentGateway — factory tipada', () => {
  test('adapter completo → acceso a cada método retorna la función', () => {
    const gw = createContentGateway(makeFullAdapter());
    expect(typeof gw.getNoticias).toBe('function');
    expect(typeof gw.getGoleadores).toBe('function');
  });

  test('adapter sin un método required → lanza al acceder', () => {
    const adapter = makeFullAdapter();
    delete adapter.getBracket;
    const gw = createContentGateway(adapter);
    expect(() => gw.getBracket()).toThrow(/getBracket is not implemented/);
  });

  test('adapter inválido (string) → lanza error', () => {
    expect(() => createContentGateway('invalid')).toThrow(/adapter must be an object/);
  });
});