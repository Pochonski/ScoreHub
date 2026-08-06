/**
 * tests/unit/betTrackingEngine.test.js — Fase 2 (mejora de tests)
 *
 * Motor de seguimiento (path WhatsApp/cron). Testeamos las funciones puras
 * evaluarSeleccion (resuelve cumplida/pendiente) y parseStatsResponse.
 * Se mockean deps (cron/db/cache/notificaciones) para aislar la lógica.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../database/connection', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../database/db', () => ({ execAdvanced: jest.fn() }));
jest.mock('../../services/mundialCache', () => ({ getMatchStats: jest.fn() }));
jest.mock('../../services/notificationService', () => ({}));

const { evaluarSeleccion, parseStatsResponse } = require('../../services/betTrackingEngine');

describe('betTrackingEngine.evaluarSeleccion', () => {
  test('corners_over usa >= (línea justa = cumplida)', () => {
    expect(evaluarSeleccion({ tipo: 'corners_over', linea: 8 }, { totalCorners: 8 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'corners_over', linea: 8 }, { totalCorners: 7 })).toBe('pendiente');
  });

  test('goles_over / goles_under', () => {
    expect(evaluarSeleccion({ tipo: 'goles_over', linea: 2 }, { totalGoals: 2 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'goles_over', linea: 2 }, { totalGoals: 1 })).toBe('pendiente');
    expect(evaluarSeleccion({ tipo: 'goles_under', linea: 2 }, { totalGoals: 2 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'goles_under', linea: 2 }, { totalGoals: 3 })).toBe('pendiente');
  });

  test('ambos_marcan: ambos > 0', () => {
    expect(evaluarSeleccion({ tipo: 'ambos_marcan' }, { goalsHome: 1, goalsAway: 2 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'ambos_marcan' }, { goalsHome: 0, goalsAway: 2 })).toBe('pendiente');
  });

  test('resultado_final local: gana si goalsHome > goalsAway', () => {
    expect(evaluarSeleccion({ tipo: 'resultado_final', valor: 'local' }, { goalsHome: 2, goalsAway: 1 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'resultado_final', valor: 'local' }, { goalsHome: 1, goalsAway: 1 })).toBe('pendiente');
  });

  test('handicap_local: (goalsHome - linea) > goalsAway', () => {
    expect(evaluarSeleccion({ tipo: 'handicap_local', linea: 1 }, { goalsHome: 3, goalsAway: 1 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'handicap_local', linea: 1 }, { goalsHome: 2, goalsAway: 1 })).toBe('pendiente');
  });

  test('tarjetas_over usa >=', () => {
    expect(evaluarSeleccion({ tipo: 'tarjetas_over', linea: 3 }, { totalCards: 3 })).toBe('cumplida');
    expect(evaluarSeleccion({ tipo: 'tarjetas_over', linea: 3 }, { totalCards: 2 })).toBe('pendiente');
  });

  test('tipo desconocido → pendiente', () => {
    expect(evaluarSeleccion({ tipo: 'mercado_raro', linea: 1 }, {})).toBe('pendiente');
  });
});

describe('betTrackingEngine.parseStatsResponse', () => {
  test('respuesta nula → todo en cero, matchEnded false', () => {
    expect(parseStatsResponse(null)).toMatchObject({
      goalsHome: 0, goalsAway: 0, totalCorners: 0, totalCards: 0, matchEnded: false,
    });
  });

  test('parsea córners (home + away)', () => {
    const r = parseStatsResponse({ 'Corner kicks': { home: 5, away: 4 } });
    expect(r).toMatchObject({ totalCorners: 9, homeCorners: 5, awayCorners: 4 });
  });

  test('suma tarjetas amarillas y rojas en totalCards', () => {
    const r = parseStatsResponse({
      'Yellow cards': { home: 2, away: 1 },
      'Red cards': { home: 1, away: 0 },
    });
    expect(r.totalCards).toBe(4); // 3 amarillas + 1 roja
  });
});
