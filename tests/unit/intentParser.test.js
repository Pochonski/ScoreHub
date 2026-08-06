/**
 * tests/unit/intentParser.test.js — Fase 2 (mejora de tests)
 *
 * Clasificador de intenciones. quickParse/isConfident son deterministas.
 * parseIntent tiene ramas deterministas (vacío, slash-command, chat obvio) que
 * NO llaman a Gemini, y una rama IA que mockeamos.
 */

const mockAnalyze = jest.fn();
jest.mock('../../services/geminiService', () => ({ analyzeMessageRaw: mockAnalyze }));

const { parseIntent, isConfident, quickParse, CONFIDENCE_THRESHOLD } = require('../../services/intentParser');

beforeEach(() => mockAnalyze.mockReset());

describe('intentParser.quickParse — slash commands deterministas', () => {
  test('/follow 555 → follow all_events con confidence 1.0', () => {
    expect(quickParse('/follow 555')).toEqual({
      intent: 'follow', ticketId: '555', gameId: null, teamName: null, mode: 'all_events', confidence: 1.0,
    });
  });

  test.each(['outcome', 'outcome_only', 'final'])('/follow 123 %s → mode outcome_only', (kw) => {
    expect(quickParse(`/follow 123 ${kw}`).mode).toBe('outcome_only');
  });

  test('/unfollow 555 → unfollow', () => {
    expect(quickParse('/unfollow 555')).toMatchObject({ intent: 'unfollow', ticketId: '555', confidence: 1.0 });
  });

  test.each(['/misapuestas', '/siguiendo'])('%s → list_followed', (cmd) => {
    expect(quickParse(cmd).intent).toBe('list_followed');
  });

  test('/live → query_live', () => {
    expect(quickParse('/live').intent).toBe('query_live');
  });

  test('/stats sin equipo → query_stats, teamName null, confidence 0.7', () => {
    expect(quickParse('/stats')).toMatchObject({ intent: 'query_stats', teamName: null, confidence: 0.7 });
  });

  test('/stats Portugal → query_stats con teamName y confidence 0.9', () => {
    expect(quickParse('/stats Portugal')).toMatchObject({ intent: 'query_stats', teamName: 'Portugal', confidence: 0.9 });
  });

  test.each(['hola', 'seguime el 555', '', null])('mensaje no-comando (%s) → null', (msg) => {
    expect(quickParse(msg)).toBeNull();
  });
});

describe('intentParser.isConfident', () => {
  test('CONFIDENCE_THRESHOLD es 0.6', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.6);
  });
  test.each([
    [0.6, true],
    [0.9, true],
    [0.59, false],
    [0, false],
  ])('confidence %s → %s', (confidence, esperado) => {
    expect(isConfident({ confidence })).toBe(esperado);
  });
});

describe('intentParser.parseIntent — ramas sin Gemini', () => {
  test('mensaje vacío → chat confidence 0 (sin llamar a Gemini)', async () => {
    const r = await parseIntent('   ');
    expect(r).toMatchObject({ intent: 'chat', confidence: 0 });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  test('slash-command usa quickParse (sin Gemini)', async () => {
    const r = await parseIntent('/follow 777');
    expect(r).toMatchObject({ intent: 'follow', ticketId: '777', confidence: 1.0 });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  test('chat obvio ("hola") → chat 0.5 (sin Gemini)', async () => {
    const r = await parseIntent('hola');
    expect(r).toMatchObject({ intent: 'chat', confidence: 0.5 });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

describe('intentParser.parseIntent — rama Gemini (mockeada)', () => {
  test('normaliza la respuesta de Gemini (ticketId/gameId a string)', async () => {
    mockAnalyze.mockResolvedValueOnce({ intent: 'follow', ticketId: 555, gameId: 4749268, confidence: 0.9 });
    const r = await parseIntent('quiero saber que pasa con el ticket ese');
    expect(r).toMatchObject({ intent: 'follow', ticketId: '555', gameId: '4749268', confidence: 0.9 });
  });

  test('error de Gemini → fallback chat 0.3', async () => {
    mockAnalyze.mockRejectedValueOnce(new Error('boom'));
    const r = await parseIntent('mensaje ambiguo sobre apuestas y partidos xyz');
    expect(r).toMatchObject({ intent: 'chat', confidence: 0.3 });
  });
});
