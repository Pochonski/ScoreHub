/**
 * tests/unit/betEvaluator.test.js — Fase 2 (mejora de tests)
 *
 * Lógica de resolución de apuestas (win/lose/push) dada la situación del
 * partido. Es el núcleo crítico: un error aquí = notificar mal al usuario.
 * Se mockean db/connection (las funciones puras no los usan).
 */

jest.mock('../../database/connection', () => ({
  pool: { query: jest.fn() },
  pgQueryRetry: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock('../../database/db', () => ({ execAdvanced: jest.fn() }));

const {
  STATES, BET_TYPES, extractStatsFromSnapshot, evaluateTicket, statusChanged,
} = require('../../services/betEvaluator');

const ev = (tipo, sel, state) => BET_TYPES[tipo].evaluate(sel, state);

describe('BET_TYPES.evaluate — resolución por mercado', () => {
  test('goles_over: > línea gana, = empuja, < pendiente', () => {
    expect(ev('goles_over', { linea: 2.5 }, { totalGoals: 3 }).status).toBe(STATES.WINNING);
    expect(ev('goles_over', { linea: 2 }, { totalGoals: 2 }).status).toBe(STATES.PUSH);
    expect(ev('goles_over', { linea: 2.5 }, { totalGoals: 2 }).status).toBe(STATES.PENDING);
  });

  test('goles_under: < línea gana, = empuja, > pierde', () => {
    expect(ev('goles_under', { linea: 2.5 }, { totalGoals: 2 }).status).toBe(STATES.WINNING);
    expect(ev('goles_under', { linea: 2 }, { totalGoals: 2 }).status).toBe(STATES.PUSH);
    expect(ev('goles_under', { linea: 2.5 }, { totalGoals: 3 }).status).toBe(STATES.LOSING);
  });

  test('ambos_marcan: ambos > 0 gana, si no pendiente', () => {
    expect(ev('ambos_marcan', {}, { homeGoals: 1, awayGoals: 2 }).status).toBe(STATES.WINNING);
    expect(ev('ambos_marcan', {}, { homeGoals: 0, awayGoals: 2 }).status).toBe(STATES.PENDING);
  });

  test('ambos_no_marcan: 0 goles gana, si hay goles pierde', () => {
    expect(ev('ambos_no_marcan', {}, { totalGoals: 0 }).status).toBe(STATES.WINNING);
    expect(ev('ambos_no_marcan', {}, { totalGoals: 1 }).status).toBe(STATES.LOSING);
  });

  test('resultado_final: local/empate según marcador', () => {
    const st = { homeGoals: 2, awayGoals: 1, homeName: 'A', awayName: 'B' };
    expect(ev('resultado_final', { valor: 'local' }, st).status).toBe(STATES.WINNING);
    expect(ev('resultado_final', { valor: 'visitante' }, st).status).toBe(STATES.LOSING);
    expect(ev('resultado_final', { valor: 'empate' }, { homeGoals: 1, awayGoals: 1 }).status).toBe(STATES.WINNING);
    expect(ev('resultado_final', { valor: 'empate' }, st).status).toBe(STATES.LOSING);
  });

  test('handicap_local: aplica la línea al marcador local', () => {
    // home 2 - 1 linea = 1 adj; away 0 → gana
    expect(ev('handicap_local', { linea: 1 }, { homeGoals: 2, awayGoals: 0 }).status).toBe(STATES.WINNING);
    // home 1 - 1 = 0 adj vs away 1 → pierde
    expect(ev('handicap_local', { linea: 1 }, { homeGoals: 1, awayGoals: 1 }).status).toBe(STATES.LOSING);
    // home 2 - 1 = 1 adj vs away 1 → push
    expect(ev('handicap_local', { linea: 1 }, { homeGoals: 2, awayGoals: 1 }).status).toBe(STATES.PUSH);
  });

  test('tarjetas_over y corners_over: > línea gana, si no pendiente', () => {
    expect(ev('tarjetas_over', { linea: 3 }, { totalCards: 4 }).status).toBe(STATES.WINNING);
    expect(ev('tarjetas_over', { linea: 3 }, { totalCards: 3 }).status).toBe(STATES.PENDING);
    expect(ev('corners_over', { linea: 8 }, { totalCorners: 9 }).status).toBe(STATES.WINNING);
    expect(ev('corners_over', { linea: 8 }, { totalCorners: 8 }).status).toBe(STATES.PENDING);
  });
});

describe('betEvaluator.extractStatsFromSnapshot', () => {
  test('snapshot vacío/sin statistics → todo en cero', () => {
    expect(extractStatsFromSnapshot(null)).toMatchObject({ totalGoals: 0, totalCards: 0, totalCorners: 0 });
    expect(extractStatsFromSnapshot({}).totalGoals).toBe(0);
  });

  test('extrae goles (id 1), tarjetas (id 2/5) y córners (id 6)', () => {
    const snap = {
      homeCompetitor: { name: 'A' },
      awayCompetitor: { name: 'B' },
      statistics: [
        { id: 1, competitorId: 10, value: '2' },
        { id: 1, competitorId: 20, value: '1' },
        { id: 2, competitorId: 10, value: '3' },
        { id: 5, competitorId: 20, value: '1' },
        { id: 6, competitorId: 10, value: '5' },
      ],
    };
    const r = extractStatsFromSnapshot(snap);
    expect(r).toMatchObject({
      homeGoals: 2, awayGoals: 1, totalGoals: 3,
      totalCards: 4, totalCorners: 5, homeName: 'A', awayName: 'B',
    });
  });
});

describe('betEvaluator.evaluateTicket — estado global del ticket', () => {
  const state = { totalGoals: 3, homeGoals: 2, awayGoals: 1 };

  test('todas ganando → ticket WINNING', async () => {
    const ticket = { id: 1, selecciones: [
      { id: 'a', tipo: 'goles_over', linea: 1 },
      { id: 'b', tipo: 'ambos_marcan' },
    ] };
    const r = await evaluateTicket(ticket, state);
    expect(r.status).toBe(STATES.WINNING);
    expect(r.selecciones).toHaveLength(2);
  });

  test('una perdiendo → ticket LOSING (LOSING domina)', async () => {
    const ticket = { id: 2, selecciones: [
      { id: 'a', tipo: 'goles_over', linea: 1 },   // winning
      { id: 'b', tipo: 'goles_under', linea: 1 },  // losing (3 > 1)
    ] };
    const r = await evaluateTicket(ticket, state);
    expect(r.status).toBe(STATES.LOSING);
  });

  test('tipo no soportado → status "unsupported", no rompe', async () => {
    const ticket = { id: 3, selecciones: [{ id: 'a', tipo: 'mercado_raro' }] };
    const r = await evaluateTicket(ticket, state);
    expect(r.selecciones[0].status).toBe('unsupported');
  });

  test('sin ticket o sin gameState → null', async () => {
    expect(await evaluateTicket(null, state)).toBeNull();
    expect(await evaluateTicket({ id: 1, selecciones: [] }, null)).toBeNull();
  });
});

describe('betEvaluator.statusChanged', () => {
  const base = { status: STATES.PENDING, selecciones: [{ status: STATES.PENDING, value: 0 }] };

  test('sin previo → cambió (true)', () => {
    expect(statusChanged(null, base)).toBe(true);
  });

  test('mismo status y selecciones → no cambió (false)', () => {
    expect(statusChanged(base, { status: STATES.PENDING, selecciones: [{ status: STATES.PENDING, value: 0 }] })).toBe(false);
  });

  test('status global distinto → cambió', () => {
    expect(statusChanged(base, { status: STATES.WINNING, selecciones: base.selecciones })).toBe(true);
  });

  test('cambia el status de una selección → cambió', () => {
    expect(statusChanged(base, { status: STATES.PENDING, selecciones: [{ status: STATES.WINNING, value: 0 }] })).toBe(true);
  });
});
