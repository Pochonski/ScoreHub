/**
 * tests/unit/processBetImage.test.js — Verificación del use-case processBetImage (Fase 8).
 */

const {
  createProcessBetImage,
  createGetApuestasUsuario,
  createFormatearApuesta,
} = require('../../src/application/bets/processBetImage');

function makeRepo(overrides = {}) {
  return {
    insert: jest.fn(),
    setImagenUrl: jest.fn(),
    insertSelection: jest.fn(),
    listByUser: jest.fn(),
    ...overrides,
  };
}

function makeOcrService(text = 'Brasil vs Argentina\nMarcador: 1-0', confidence = 0.9) {
  return { procesarImagen: jest.fn().mockResolvedValue({ text, confidence }) };
}

function makeBetTracking() {
  return { isRunning: jest.fn().mockReturnValue(false), iniciar: jest.fn() };
}

const silentLogger = { error: jest.fn(), warn: jest.fn() };

function buildDeps(overrides = {}) {
  return {
    ocrService: overrides.ocrService ?? makeOcrService(),
    parseBetText: overrides.parseBetText ?? jest.fn().mockReturnValue({ ok: true }),
    toJSON: overrides.toJSON ?? jest.fn().mockReturnValue({
      partido: 'Brasil vs Argentina',
      partido_detectado: 'Brasil vs Argentina',
      confianza_ocr: 0.9,
      minuto: 35,
      marcador: { local: 1, visitante: 0 },
      selecciones: [
        { tipo: 'resultado_final', valor: 'Brasil', linea: null, estado: 'pendiente' },
        { tipo: 'corners_over', valor: 'Over 9.5', linea: 9.5, estado: 'pendiente' },
      ],
    }),
    buscarPartidoReal: overrides.buscarPartidoReal ?? jest.fn().mockResolvedValue({
      id: 999, homeTeam: { name: 'Brasil' }, awayTeam: { name: 'Argentina' },
      homeScore: 1, awayScore: 0, tournament: 'Copa', date: '2026-01-01',
    }),
    formatTeamWithFlag: overrides.formatTeamWithFlag ?? ((n) => `🏳️ ${n}`),
    guardarImagen: overrides.guardarImagen ?? jest.fn().mockReturnValue('/img/test.png'),
    generarNombreArchivo: overrides.generarNombreArchivo ?? jest.fn().mockReturnValue('test.png'),
    betRepository: overrides.betRepository ?? makeRepo({
      insert: jest.fn().mockResolvedValue({ id: 555 }),
    }),
    betTrackingEngine: overrides.betTrackingEngine ?? makeBetTracking(),
    testConnection: overrides.testConnection ?? jest.fn().mockResolvedValue(true),
    logger: silentLogger,
  };
}

describe('createProcessBetImage', () => {
  test('throws if ocrService missing', () => {
    expect(() => createProcessBetImage({
      parseBetText: jest.fn(), toJSON: jest.fn(), buscarPartidoReal: jest.fn(),
      formatTeamWithFlag: jest.fn(), guardarImagen: jest.fn(), generarNombreArchivo: jest.fn(),
      betRepository: makeRepo(),
    })).toThrow(/ocrService required/);
  });

  test('throws if betRepository missing', () => {
    expect(() => createProcessBetImage({
      ocrService: makeOcrService(),
      parseBetText: jest.fn(), toJSON: jest.fn(), buscarPartidoReal: jest.fn(),
      formatTeamWithFlag: jest.fn(), guardarImagen: jest.fn(), generarNombreArchivo: jest.fn(),
    })).toThrow(/betRepository required/);
  });

  test('happy path inserts bet + selections + tracking', async () => {
    const deps = buildDeps();
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });

    expect(deps.betRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: 'u1',
      partidoExtrado: 'Brasil vs Argentina',
      idPartidoApi: 999,
    }));
    expect(deps.betRepository.setImagenUrl).toHaveBeenCalledWith(555, '/img/test.png');
    expect(deps.betRepository.insertSelection).toHaveBeenCalledTimes(2);
    expect(deps.betTrackingEngine.iniciar).toHaveBeenCalledWith(60);
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/APUESTA GUARDADA/));
  });

  test('returns db-down message when testConnection fails', async () => {
    const deps = buildDeps();
    deps.testConnection = jest.fn().mockResolvedValue(false);
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/No hay conexión a la base de datos/));
    expect(deps.betRepository.insert).not.toHaveBeenCalled();
  });

  test('rejects when OCR text is too short', async () => {
    const deps = buildDeps();
    deps.ocrService = makeOcrService('ab'); // < 10 chars
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/No pude leer texto/));
    expect(deps.betRepository.insert).not.toHaveBeenCalled();
  });

  test('rejects when confidence below threshold', async () => {
    const deps = buildDeps();
    deps.ocrService = makeOcrService('some text here that is long enough to pass', 0.3);
    deps.toJSON = jest.fn().mockReturnValue({
      partido: 'A vs B', partido_detectado: 'A vs B', confianza_ocr: 0.3,
      marcador: { local: 0, visitante: 0 }, selecciones: [],
    });
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/no tiene suficiente calidad/));
  });

  test('rejects when no partido detected', async () => {
    const deps = buildDeps();
    deps.toJSON = jest.fn().mockReturnValue({
      partido: '', partido_detectado: null, confianza_ocr: 0.9,
      marcador: { local: 0, visitante: 0 }, selecciones: [],
    });
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/No pude identificar el partido/));
  });

  test('handles partido not found in API gracefully', async () => {
    const deps = buildDeps();
    deps.buscarPartidoReal = jest.fn().mockResolvedValue(null);
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });
    expect(deps.betRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ idPartidoApi: null }));
    expect(deps.betTrackingEngine.iniciar).not.toHaveBeenCalled();
  });

  test('does not start tracking if already running', async () => {
    const deps = buildDeps();
    deps.betTrackingEngine = { isRunning: jest.fn().mockReturnValue(true), iniciar: jest.fn() };
    const uc = createProcessBetImage(deps);
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply: jest.fn() });
    expect(deps.betTrackingEngine.iniciar).not.toHaveBeenCalled();
  });

  test('catches errors and replies with friendly message', async () => {
    const deps = buildDeps();
    deps.betRepository.insert.mockRejectedValue(new Error('DB down'));
    const uc = createProcessBetImage(deps);
    const safeReply = jest.fn();
    await uc({ userId: 'u1', mediaBuffer: Buffer.from('img'), mimeType: 'image/png', safeReply });
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/Ocurrió un error procesando/));
    expect(safeReply).toHaveBeenCalledWith(expect.stringMatching(/DB down/));
  });
});

describe('createGetApuestasUsuario', () => {
  test('throws if betRepository missing', () => {
    expect(() => createGetApuestasUsuario({})).toThrow(/betRepository required/);
  });

  test('delegates to repo', async () => {
    const repo = makeRepo({ listByUser: jest.fn().mockResolvedValue([{ id: 1 }]) });
    const uc = createGetApuestasUsuario({ betRepository: repo });
    expect(await uc('u1')).toEqual([{ id: 1 }]);
    expect(repo.listByUser).toHaveBeenCalledWith('u1');
  });
});

describe('createFormatearApuesta', () => {
  test('formats open bet', () => {
    const fmt = createFormatearApuesta();
    const out = fmt({
      id: 555,
      estado: 'abierta',
      partidoNormalizado: 'Brasil vs Argentina',
      marcadorLocal: 1,
      marcadorVisitante: 0,
      selecciones: [
        { tipoMercado: 'resultado_final', valorSeleccion: 'Brasil', estado: 'pendiente' },
      ],
    });
    expect(out).toMatch(/🔄 \*APUESTA #555\*/);
    expect(out).toMatch(/Brasil vs Argentina/);
    expect(out).toMatch(/⏳ Brasil/);
  });

  test('formats won bet', () => {
    const fmt = createFormatearApuesta();
    const out = fmt({
      id: 1,
      estado: 'completada',
      resultadoFinal: 'ganada',
      partidoNormalizado: 'A vs B',
      marcadorLocal: 2,
      marcadorVisitante: 1,
      selecciones: [],
    });
    expect(out).toMatch(/🎉/);
  });

  test('formats lost bet', () => {
    const fmt = createFormatearApuesta();
    const out = fmt({
      id: 1,
      estado: 'completada',
      resultadoFinal: 'perdida',
      partidoNormalizado: 'A vs B',
      marcadorLocal: 0,
      marcadorVisitante: 3,
      selecciones: [],
    });
    expect(out).toMatch(/❌/);
  });
});
