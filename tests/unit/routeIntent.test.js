/**
 * tests/unit/routeIntent.test.js — Verificación del use-case routeIntent (Fase 8).
 */

const { createRouteIntent } = require('../../src/application/orchestration/routeIntent');

const INTENTOS = {
  PARTIDOS_HOY: 'PARTIDOS_HOY',
  PARTIDOS_FECHA: 'PARTIDOS_FECHA',
  RESULTADO: 'RESULTADO',
  RESULTADO_VS: 'RESULTADO_VS',
  PROXIMOS: 'PROXIMOS',
  INFO_EQUIPO: 'INFO_EQUIPO',
  ESTADISTICA: 'ESTADISTICA',
  TABLA: 'TABLA',
  TABLA_MUNDIAL: 'TABLA_MUNDIAL',
  TABLA_GRUPO: 'TABLA_GRUPO',
  ANALISIS: 'ANALISIS',
  SEGUIR_EQUIPO: 'SEGUIR_EQUIPO',
  DEJAR_SEGUIR: 'DEJAR_SEGUIR',
  MIS_EQUIPOS: 'MIS_EQUIPOS',
};

function makeUseCases(overrides = {}) {
  return {
    matches: {
      partidosHoy: jest.fn().mockResolvedValue('partidos-hoy'),
      partidosFecha: jest.fn().mockResolvedValue('partidos-fecha'),
      resultadoEquipo: jest.fn().mockResolvedValue('resultado'),
      resultadoVS: jest.fn().mockResolvedValue('vs'),
      proximosEquipo: jest.fn().mockResolvedValue('proximos'),
      ...(overrides.matches || {}),
    },
    teams: {
      infoEquipo: jest.fn().mockResolvedValue('info'),
      seguirEquipo: jest.fn().mockResolvedValue('seguir'),
      dejarSeguirEquipo: jest.fn().mockResolvedValue('dejar'),
      getEquiposSeguidos: jest.fn().mockResolvedValue('misequipos'),
      ...(overrides.teams || {}),
    },
    betting: {
      analizarEnfrentamiento: jest.fn().mockResolvedValue('vs-analysis'),
      analizarEquipo: jest.fn().mockResolvedValue('eq-analysis'),
      ...(overrides.betting || {}),
    },
    teamStats: {
      estadisticas: jest.fn().mockResolvedValue('stats'),
      goleadores: jest.fn().mockResolvedValue('goleadores'),
      ...(overrides.teamStats || {}),
    },
    standings: {
      tabla: jest.fn().mockResolvedValue('tabla'),
      ...(overrides.standings || {}),
    },
    ...overrides,
  };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

describe('createRouteIntent', () => {
  test('throws if useCases missing', () => {
    expect(() => createRouteIntent({ INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn() })).toThrow(/useCases required/);
  });

  test('throws if INTENTOS missing', () => {
    expect(() => createRouteIntent({ useCases: makeUseCases(), safeReply: jest.fn(), saveHistory: jest.fn() })).toThrow(/INTENTOS required/);
  });

  test('throws if safeReply missing', () => {
    expect(() => createRouteIntent({ useCases: makeUseCases(), INTENTOS, saveHistory: jest.fn() })).toThrow(/safeReply required/);
  });

  test('throws if saveHistory missing', () => {
    expect(() => createRouteIntent({ useCases: makeUseCases(), INTENTOS, safeReply: jest.fn() })).toThrow(/saveHistory required/);
  });

  test('PARTIDOS_HOY routes to matches.partidosHoy', async () => {
    const safeReply = jest.fn();
    const saveHistory = jest.fn();
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply, saveHistory, logger: silentLogger });
    await route({ userId: 'u1', text: 'partidos hoy', parsed: { intent: INTENTOS.PARTIDOS_HOY } });
    expect(useCases.matches.partidosHoy).toHaveBeenCalled();
    expect(safeReply).toHaveBeenCalledWith('partidos-hoy');
    expect(saveHistory).toHaveBeenCalledWith('u1', 'partidos hoy', INTENTOS.PARTIDOS_HOY, 'partidos-hoy');
  });

  test('PARTIDOS_FECHA passes fecha to matches.partidosFecha', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'partidos 20260101', parsed: { intent: INTENTOS.PARTIDOS_FECHA, fecha: '20260101' } });
    expect(useCases.matches.partidosFecha).toHaveBeenCalledWith('20260101');
  });

  test('RESULTADO routes to matches.resultadoEquipo', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'cómo quedó brasil', parsed: { intent: INTENTOS.RESULTADO, equipo: 'Brasil' } });
    expect(useCases.matches.resultadoEquipo).toHaveBeenCalledWith('Brasil');
  });

  test('INFO_EQUIPO routes to teams.infoEquipo', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'info brasil', parsed: { intent: INTENTOS.INFO_EQUIPO, equipo: 'Brasil' } });
    expect(useCases.teams.infoEquipo).toHaveBeenCalledWith('Brasil');
  });

  test('ANALISIS with home+away routes to analizarEnfrentamiento', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'analiza', parsed: { intent: INTENTOS.ANALISIS, home: 'A', away: 'B' } });
    expect(useCases.betting.analizarEnfrentamiento).toHaveBeenCalledWith('A', 'B');
  });

  test('ANALISIS with equipo only routes to analizarEquipo', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'analiza brasil', parsed: { intent: INTENTOS.ANALISIS, equipo: 'Brasil' } });
    expect(useCases.betting.analizarEquipo).toHaveBeenCalledWith('Brasil');
  });

  test('ANALISIS without team returns error message', async () => {
    const useCases = makeUseCases();
    const safeReply = jest.fn();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply, saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'analiza', parsed: { intent: INTENTOS.ANALISIS } });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/Indica dos equipos/));
  });

  test('SEGUIR_EQUIPO passes userId and equipo', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'seguir brasil', parsed: { intent: INTENTOS.SEGUIR_EQUIPO, equipo: 'Brasil' } });
    expect(useCases.teams.seguirEquipo).toHaveBeenCalledWith('u1', 'Brasil');
  });

  test('MIS_EQUIPOS routes to teams.getEquiposSeguidos', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'mis equipos', parsed: { intent: INTENTOS.MIS_EQUIPOS } });
    expect(useCases.teams.getEquiposSeguidos).toHaveBeenCalledWith('u1');
  });

  test('Unknown intent returns friendly default message', async () => {
    const useCases = makeUseCases();
    const safeReply = jest.fn();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply, saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'foo bar baz', parsed: { intent: 'unknown_intent' } });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/No entendí/));
  });

  test('errors in use-case return generic error and still reply', async () => {
    const useCases = makeUseCases();
    useCases.matches.partidosHoy.mockRejectedValue(new Error('boom'));
    const safeReply = jest.fn();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply, saveHistory: jest.fn(), logger: silentLogger });
    await route({ userId: 'u1', text: 'partidos hoy', parsed: { intent: INTENTOS.PARTIDOS_HOY } });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/Ocurrió un error/));
  });

  test('ESTADISTICA routes to teamStats.estadisticas with full parsed', async () => {
    const useCases = makeUseCases();
    const route = createRouteIntent({ useCases, INTENTOS, safeReply: jest.fn(), saveHistory: jest.fn(), logger: silentLogger });
    const parsed = { intent: INTENTOS.ESTADISTICA, tipo: 'goles', equipo: 'Brasil' };
    await route({ userId: 'u1', text: 'goles brasil', parsed });
    expect(useCases.teamStats.estadisticas).toHaveBeenCalledWith(parsed);
  });
});
