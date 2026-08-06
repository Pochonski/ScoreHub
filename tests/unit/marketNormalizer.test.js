/**
 * tests/unit/marketNormalizer.test.js — Fase 2 (mejora de tests)
 *
 * Lógica pura de normalización de mercados de apuestas. Sin deps externas.
 */

const {
  normalizarMercado,
  normalizarEquipo,
  detectarMarcador,
  detectarMinuto,
  normalizarSeleccion,
} = require('../../services/marketNormalizer');

describe('marketNormalizer.normalizarMercado', () => {
  test.each([
    ['Más de 5 corners', 'corners_over', 5],
    ['menos de 7 corners', 'corners_under', 7],
    ['tarjetas over', 'tarjetas_over', null],
    ['both teams to score', 'ambos_marcan', null],
    ['btts', 'ambos_marcan', null],
    ['ambos no marcan', 'ambos_no_marcan', null],
    ['resultado final', 'resultado_final', null],
    ['primer tiempo', 'resultado_primer_tiempo', null],
    ['doble chance', 'doble_chance', null],
    ['correct score', 'resultado_exacto', null],
  ])('%s → tipo %s, linea %s', (texto, tipoEsperado, lineaEsperada) => {
    const r = normalizarMercado(texto);
    expect(r.tipo).toBe(tipoEsperado);
    expect(r.linea).toBe(lineaEsperada);
    expect(r.normalizado).toBe(true);
    expect(r.valor).toBe(texto.trim());
  });

  test('prioriza el más específico: "over 5 corners" es corners, no goles', () => {
    expect(normalizarMercado('over 5 corners').tipo).toBe('corners_over');
  });

  test('normaliza acentos antes de matchear ("córners" → corners)', () => {
    expect(normalizarMercado('más córners over').tipo).toBe('corners_over');
  });

  test('mercado desconocido → tipo "desconocido", normalizado=false', () => {
    const r = normalizarMercado('texto aleatorio sin mercado');
    expect(r.tipo).toBe('desconocido');
    expect(r.normalizado).toBe(false);
  });

  test('extrae la primera línea numérica del texto', () => {
    expect(normalizarMercado('goles over 2.5').linea).toBe(2.5);
  });
});

describe('marketNormalizer.normalizarEquipo', () => {
  test.each([
    ['Real Madrid C.F.', 'real madrid cf'],
    ['Atlético', 'atletico'],
    ['  Manchester   United  ', 'manchester united'],
    ['Bayern Münich', 'bayern munich'],
  ])('%s → %s', (input, esperado) => {
    expect(normalizarEquipo(input)).toBe(esperado);
  });
});

describe('marketNormalizer.detectarMarcador', () => {
  test.each([
    ['2-1', { local: 2, visitante: 1 }],
    ['2 - 1', { local: 2, visitante: 1 }],
    ['3:0', { local: 3, visitante: 0 }],
    ['El partido va 1 - 4', { local: 1, visitante: 4 }],
  ])('%s → %o', (texto, esperado) => {
    expect(detectarMarcador(texto)).toEqual(esperado);
  });

  test('texto sin marcador → null', () => {
    expect(detectarMarcador('sin numeros aqui')).toBeNull();
  });
});

describe('marketNormalizer.detectarMinuto', () => {
  test.each([
    ['HT', 45],
    ['half time', 45],
    ['FT', 90],
    ['full time', 90],
    ["45'", 45],
    ['90 min', 90],
  ])('%s → %s', (texto, esperado) => {
    expect(detectarMinuto(texto)).toBe(esperado);
  });

  test('texto sin minuto → null', () => {
    expect(detectarMinuto('texto sin numeros')).toBeNull();
  });
});

describe('marketNormalizer.normalizarSeleccion', () => {
  test('normaliza usando el valor y marca estado pendiente', () => {
    const r = normalizarSeleccion({ valor: 'Más de 5 corners' });
    expect(r.tipo).toBe('corners_over');
    expect(r.linea).toBe(5);
    expect(r.estado).toBe('pendiente');
  });

  test('usa seleccion.linea como fallback si el texto no trae número', () => {
    const r = normalizarSeleccion({ valor: 'corners over', linea: 8 });
    expect(r.tipo).toBe('corners_over');
    expect(r.linea).toBe(8);
  });
});
