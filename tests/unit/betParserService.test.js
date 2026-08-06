/**
 * tests/unit/betParserService.test.js — Fase 2 (mejora de tests)
 *
 * Parsing de texto OCR → estructura de apuesta. parseBetText y toJSON son
 * puros. Se mockea mundialCache (solo lo usa buscarPartidoReal, no testeado
 * aquí porque pega a API/DB).
 */

jest.mock('../../services/mundialCache', () => ({
  getTeamByName: jest.fn(),
  getRecentWorldCupMatchesByTeam: jest.fn(),
}));

const { parseBetText, toJSON, ApuestaExtraida } = require('../../services/betParserService');

describe('betParserService.parseBetText', () => {
  const texto = [
    'Brasil vs Argentina',
    "45'",
    '2 - 1',
    'Más de 5 corners',
    'Ambos marcan',
  ].join('\n');

  test('detecta partido, minuto, marcador y selecciones', () => {
    const a = parseBetText(texto);
    expect(a).toBeInstanceOf(ApuestaExtraida);
    expect(a.partido).toMatchObject({ local: 'Brasil', visitante: 'Argentina' });
    expect(a.minuto).toBe(45);
    expect(a.marcador).toEqual({ local: 2, visitante: 1 });
    const tipos = a.selecciones.map((s) => s.tipo);
    expect(tipos).toContain('corners_over');
    expect(tipos).toContain('ambos_marcan');
  });

  test('confianza alta cuando hay partido + marcador + selecciones + minuto', () => {
    const a = parseBetText(texto);
    expect(a.confianza).toBeGreaterThan(0.7);
  });

  test('texto vacío → sin partido, sin selecciones, confianza 0', () => {
    const a = parseBetText('');
    expect(a.partido).toBeNull();
    expect(a.selecciones).toHaveLength(0);
    expect(a.confianza).toBe(0);
  });
});

describe('betParserService.toJSON', () => {
  test('serializa la apuesta a formato JSON esperado', () => {
    const a = parseBetText(['Brasil vs Argentina', "45'", '2 - 1', 'Ambos marcan'].join('\n'));
    const json = toJSON(a);
    expect(json.partido).toBe('Brasil vs Argentina');
    expect(json.minuto).toBe(45);
    expect(json.marcador).toEqual({ local: 2, visitante: 1 });
    expect(json.selecciones[0]).toHaveProperty('tipo');
    expect(json.selecciones[0]).toHaveProperty('estado', 'pendiente');
    expect(typeof json.confianza_ocr).toBe('number');
  });

  test('partido null → json.partido null', () => {
    const json = toJSON(new ApuestaExtraida());
    expect(json.partido).toBeNull();
    expect(json.selecciones).toEqual([]);
  });
});
