/**
 * tests/unit/betting-bugfixes.test.js
 *
 * Verifica los fixes de dos bugs encontrados por los unit tests de la Fase 2:
 *  #2 marketNormalizer: keywords de handicap ('-1','-2') colisionaban con
 *     marcadores tipo "2-1" → falsa clasificación como handicap.
 *  #3 betParserService: selectionsNoEstaDuplicado tenía el parámetro mal escrito
 *     ('selcciones') → ReferenceError al parsear una línea con cuota '@'.
 */

jest.mock('../../services/mundialCache', () => ({
  getTeamByName: jest.fn(),
  getRecentWorldCupMatchesByTeam: jest.fn(),
}));

const { normalizarMercado } = require('../../services/marketNormalizer');
const { parseBetText } = require('../../services/betParserService');

describe('fix #2 — marketNormalizer no confunde marcadores con handicaps', () => {
  test('"resultado exacto 2-1" → resultado_exacto (no handicap por el "-1")', () => {
    const r = normalizarMercado('resultado exacto 2-1');
    expect(r.tipo).toBe('resultado_exacto');
    expect(r.linea).toBe(2);
  });

  test('un marcador suelto "2-1" no se clasifica como handicap', () => {
    const r = normalizarMercado('el partido va 2-1');
    expect(r.tipo).not.toBe('handicap_local');
    expect(r.tipo).not.toBe('handicap_visitante');
  });

  test('los handicaps legítimos siguen funcionando', () => {
    expect(normalizarMercado('handicap local -1').tipo).toBe('handicap_local');
    expect(normalizarMercado('+1').tipo).toBe('handicap_visitante'); // shorthand con frontera
  });
});

describe('fix #3 — betParserService no crashea con cuotas "@"', () => {
  test('parseBetText con una línea con cuota no lanza ReferenceError', () => {
    expect(() => parseBetText('Ganador local 1.90@')).not.toThrow();
  });

  test('captura la cuota de una selección con "@"', () => {
    const a = parseBetText('Mercado especial xyz 2.50@');
    const conCuota = a.selecciones.find((s) => s.cuota != null);
    expect(conCuota).toBeDefined();
    expect(conCuota.cuota).toBe(2.5);
  });
});
