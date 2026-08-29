/**
 * tests/unit/geminiNlu.test.js — Verificación del puerto + adapter de Gemini NLU (Fase 3).
 */

const { createGeminiNluRepository, REQUIRED_METHODS } = require('../../src/domain/ports/IGeminiNluRepository');
const { GeminiNluAdapter } = require('../../src/infrastructure/nlu/GeminiNluAdapter');

function makeGeminiService(overrides = {}) {
  return {
    analyzeMessage: jest.fn(),
    analyzeMessageRaw: jest.fn(),
    generateNaturalResponse: jest.fn(),
    ...overrides,
  };
}

describe('createGeminiNluRepository — Proxy enforcement', () => {
  test('throws if adapter is not an object', () => {
    expect(() => createGeminiNluRepository(null)).toThrow(/adapter must be an object/);
    expect(() => createGeminiNluRepository('string')).toThrow(/adapter must be an object/);
  });

  test('exposes REQUIRED_METHODS', () => {
    expect(REQUIRED_METHODS).toContain('analyzeMessage');
    expect(REQUIRED_METHODS).toContain('analyzeMessageRaw');
    expect(REQUIRED_METHODS).toContain('generateNaturalResponse');
    expect(REQUIRED_METHODS.length).toBe(3);
  });

  test('passes through defined methods', () => {
    const adapter = makeGeminiService({
      analyzeMessage: jest.fn().mockReturnValue('ok'),
    });
    const repo = createGeminiNluRepository(adapter);
    expect(repo.analyzeMessage('test')).toBe('ok');
    expect(adapter.analyzeMessage).toHaveBeenCalledWith('test');
  });

  test('throws on missing method via Proxy', () => {
    const adapter = { analyzeMessage: jest.fn() }; // faltan los otros dos
    const repo = createGeminiNluRepository(adapter);
    expect(() => repo.analyzeMessageRaw('x')).toThrow(/is not implemented/);
    expect(() => repo.generateNaturalResponse('intent', {})).toThrow(/is not implemented/);
  });
});

describe('GeminiNluAdapter', () => {
  test('throws if geminiService missing', () => {
    expect(() => new GeminiNluAdapter({})).toThrow(/geminiService required/);
  });

  test('delegates analyzeMessage', async () => {
    const service = makeGeminiService({
      analyzeMessage: jest.fn().mockResolvedValue({ intent: 'PARTIDOS_HOY', entities: {} }),
    });
    const adapter = new GeminiNluAdapter({ geminiService: service });
    const out = await adapter.analyzeMessage('qué juega hoy');
    expect(service.analyzeMessage).toHaveBeenCalledWith('qué juega hoy');
    expect(out.intent).toBe('PARTIDOS_HOY');
  });

  test('delegates analyzeMessageRaw', async () => {
    const service = makeGeminiService({
      analyzeMessageRaw: jest.fn().mockResolvedValue('{"intent":"chat"}'),
    });
    const adapter = new GeminiNluAdapter({ geminiService: service });
    const out = await adapter.analyzeMessageRaw('some prompt');
    expect(service.analyzeMessageRaw).toHaveBeenCalledWith('some prompt');
    expect(out).toBe('{"intent":"chat"}');
  });

  test('delegates generateNaturalResponse', async () => {
    const service = makeGeminiService({
      generateNaturalResponse: jest.fn().mockResolvedValue('¡Buenas!'),
    });
    const adapter = new GeminiNluAdapter({ geminiService: service });
    const out = await adapter.generateNaturalResponse('SALUDO', {});
    expect(service.generateNaturalResponse).toHaveBeenCalledWith('SALUDO', {});
    expect(out).toBe('¡Buenas!');
  });

  test('exposes all three required methods when wrapped in repo', () => {
    const service = makeGeminiService();
    const adapter = new GeminiNluAdapter({ geminiService: service });
    const repo = createGeminiNluRepository(adapter);
    expect(typeof repo.analyzeMessage).toBe('function');
    expect(typeof repo.analyzeMessageRaw).toBe('function');
    expect(typeof repo.generateNaturalResponse).toBe('function');
  });
});
