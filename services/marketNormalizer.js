// Normalizador de mercados de apuestas
// Convierte diferentes formas de escribir mercados al formato interno

/**
 * Mapeo de palabras clave a tipos de mercado normalizados
 * ORDEN IMPORTANTE: Los más específicos primero!
 */
const MERCADO_KEYWORDS = {
  // Corners (específicos - antes que goles)
  'corners_over': ['corners over', 'over corners', 'mas corners', 'más corners', 'over 5 corners', '+5 corners', 'corners +', 'total corners over', 'over total corners', 'córners over', 'over córners', 'más córners', 'mas córners', 'over corners', 'over 5 corners', 'mas de 5', 'mas de 6', 'mas de 7', 'mas de 8', 'mas de 9', 'mas de 10', 'más de 5', 'más de 6', 'más de 7', 'más de 8', 'más de 9', 'más de 10'],
  'corners_under': ['corners under', 'under corners', 'menos corners', 'menos de 5', 'menos de 6', 'menos de 7', 'menos de 8', 'menos de 9', 'menos de 10', 'under 5 corners', '-5 corners', 'corners -', 'total corners under', 'córners under', 'under córners', 'menos córners'],

  // Tarjetas
  'tarjetas_over': ['tarjetas over', 'over tarjetas', 'cards over', 'over cards', 'mas tarjetas', 'más tarjetas', 'yellow cards over'],
  'tarjetas_under': ['tarjetas under', 'under tarjetas', 'cards under', 'under cards', 'menos tarjetas'],

  // Tiros
  'tiros_over': ['tiros over', 'shots over', 'shots on target over'],
  'tiros_under': ['tiros under', 'shots under'],

  // Posesión
  'posesion_over': ['posesion over', 'possession over', 'mas posesion', 'más posesion'],
  'posesion_under': ['posesion under', 'possession under', 'menos posesion'],

  // Goles
  // NOTA: No incluir 'over'/'under'/'mas de'/'menos de' genéricos - causan falsos positivos
  'goles_over': ['goles over', 'goals over', 'over goals', '+2.5', '+2', '+3', 'over 2', 'over 3', 'over goals'],
  'goles_under': ['goles under', 'goals under', 'under goals', '-2.5', '-2', '-3', 'under 2', 'under 3'],

  // Ambos marcan
  'ambos_marcan': ['ambos marcan', 'both teams to score', 'btts', 'ambos equipos', 'both teams', 'goal goal', 'both teams score'],
  'ambos_no_marcan': ['ambos no marcan', 'both teams no', 'btts no', 'no both'],

  // Resultado
  'resultado_final': ['resultado final', 'final result', 'ganador partido', 'win match', 'match winner', 'gana', 'ganador', 'win'],
  'resultado_primer_tiempo': ['primer tiempo', 'first half', 'ht result', 'resultado 1t'],
  'doble_chance': ['doble chance', 'double chance', 'dc'],

  // Jugador específico
  'jugador_over': ['jugador over', 'player over', 'haaland over', 'mbappe over', 'messi over', 'ronaldo over'],
  'jugador_menos': ['jugador under', 'player under', 'haaland under', 'mbappe under'],

  // Handicaps
  'handicap_local': ['handicap local', 'h.local', '-1', '-2', '-3', 'handicap 1'],
  'handicap_visitante': ['handicap visitante', 'h.visit', '+1', '+2', '+3', 'handicap 2'],

  // Especiales
  'par_impar': ['par', 'odd', 'even', 'impar'],
  'resultado_exacto': ['resultado exacto', 'exact score', 'score', 'correct score']
};

/**
 * ¿El texto contiene la keyword? Para keywords que son solo un número con signo
 * ('-1', '+2.5', '-2') exigimos frontera de dígito: sin esto, un marcador como
 * "2-1" (que contiene "-1") se clasificaba erróneamente como handicap.
 */
function matchesKeyword(lower, keyword) {
  if (/^[+-]?\d+(\.\d+)?$/.test(keyword)) {
    const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\d)${esc}(?!\\d)`).test(lower);
  }
  return lower.includes(keyword);
}

/**
 * Normaliza un texto de mercado al tipo interno
 * @param {string} texto - Texto del mercado (e.g., "Más de 5 corners")
 * @returns {object} { tipo: string, linea: number|null, valor: string }
 */
function normalizarMercado(texto) {
  const lower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Extraer línea numérica del texto
  const lineaMatch = lower.match(/(\d+\.?\d*)/);
  const linea = lineaMatch ? parseFloat(lineaMatch[1]) : null;

  // Buscar el tipo de mercado
  for (const [tipo, keywords] of Object.entries(MERCADO_KEYWORDS)) {
    for (const keyword of keywords) {
      if (matchesKeyword(lower, keyword)) {
        return {
          tipo,
          linea,
          valor: texto.trim(),
          normalizado: true
        };
      }
    }
  }

  // Si no se encontró ningún mercado conocido
  return {
    tipo: 'desconocido',
    linea,
    valor: texto.trim(),
    normalizado: false
  };
}

/**
 * Normaliza el nombre de un equipo
 * @param {string} nombre - Nombre del equipo
 * @returns {string} Nombre normalizado
 */
function normalizarEquipo(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Detecta si un texto es un marcador
 * @param {string} texto - Texto a verificar
 * @returns {object|null} { local: number, visitante: number } o null
 */
function detectarMarcador(texto) {
  // Patrones: "2 - 1", "2-1", "2:1", "2 1"
  const match = texto.match(/(\d+)[\s\-:]+(\d+)/);
  if (match) {
    return {
      local: parseInt(match[1]),
      visitante: parseInt(match[2])
    };
  }
  return null;
}

/**
 * Detecta el minuto del partido
 * @param {string} texto - Texto a verificar
 * @returns {number|null} Minuto o null
 */
function detectarMinuto(texto) {
  // Patrones: "45'", "45'", "45 min", "45:00", "HT", "FT"
  const lower = texto.toLowerCase();

  if (lower.includes('ht') || lower.includes('half')) return 45;
  if (lower.includes('ft') || lower.includes('full')) return 90;

  const match = texto.match(/(\d+)[\s\':]*(?:min|minute)?/i);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

/**
 * Normaliza una selección de apuesta
 * @param {object} seleccion - { tipo, valor, linea }
 * @returns {object} Selección normalizada
 */
function normalizarSeleccion(seleccion) {
  const normalizado = normalizarMercado(seleccion.valor || seleccion.tipo);

  return {
    tipo: normalizado.tipo,
    valor: normalizado.valor,
    linea: normalizado.linea || seleccion.linea,
    estado: 'pendiente'
  };
}

module.exports = {
  normalizarMercado,
  normalizarEquipo,
  detectarMarcador,
  detectarMinuto,
  normalizarSeleccion,
  MERCADO_KEYWORDS
};
