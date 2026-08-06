// Servicio de parsing de texto OCR -> JSON estructurado
const { normalizarMercado, normalizarEquipo, detectarMarcador, detectarMinuto } = require('./marketNormalizer');
const cache = require('./mundialCache');

/**
 * Representación interna de una extracción de apuesta
 */
class ApuestaExtraida {
  constructor() {
    this.partido = null;
    this.minuto = null;
    this.marcador = { local: null, visitante: null };
    this.selecciones = [];
    this.confianza = 0;
    this.errores = [];
  }
}

/**
 * Parsea el texto OCR y extrae información estructurada
 * @param {string} texto - Texto extraído del OCR
 * @returns {ApuestaExtraida}
 */
function parseBetText(texto) {
  const apuesta = new ApuestaExtraida();

  // Dividir en líneas
  const lineas = texto.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  // 1. Detectar partido (patrones comunes)
  apuesta.partido = detectarPartido(lineas);

  // 2. Detectar marcador
  apuesta.marcador = detectarMarcadorEnLineas(lineas);

  // 3. Detectar minuto
  apuesta.minuto = detectarMinutoEnLineas(lineas);

  // 4. Detectar selecciones (mercados)
  apuesta.selecciones = detectarSelecciones(lineas);

  // 5. Calcular confianza
  apuesta.confianza = calcularConfianza(apuesta, lineas);

  return apuesta;
}

/**
 * Detecta el partido en las líneas
 */
function detectarPartido(lineas) {
  // Patrones: "Brasil vs Argentina", "Brasil - Argentina", "Brasil vs Argentina"
  const patronesPartido = [
    /([a-záéíóúñ\s]+)\s*(vs|vs\.|-)\s+([a-záéíóúñ\s]+)/i,
    /([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)?)\s*[-–]\s*([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)?)/i
  ];

  for (const linea of lineas) {
    for (const patron of patronesPartido) {
      const match = linea.match(patron);
      if (match) {
        return {
          local: match[1].trim(),
          visitante: match[3].trim(),
          raw: linea
        };
      }
    }
  }

  return null;
}

/**
 * Detecta marcador en las líneas
 */
function detectarMarcadorEnLineas(lineas) {
  for (const linea of lineas) {
    const marcador = detectarMarcador(linea);
    if (marcador) {
      return marcador;
    }
  }
  return { local: null, visitante: null };
}

/**
 * Detecta minuto en las líneas
 */
function detectarMinutoEnLineas(lineas) {
  // Primero buscar en marcador (a veces viene "45' 2-1")
  for (const linea of lineas) {
    const minuto = detectarMinuto(linea);
    if (minuto !== null) {
      return minuto;
    }
  }
  return null;
}

/**
 * Detecta selecciones/mercados en las líneas
 */
function detectarSelecciones(lineas) {
  const selecciones = [];

  for (const linea of lineas) {
    const lower = linea.toLowerCase();

    // Saltar líneas que son partido o marcador
    if (detectarPartido([linea])) continue;
    if (detectarMarcador(linea)) continue;

    // Buscar patrones de apuestas
    const mercado = normalizarMercado(linea);
    if (mercado.normalizado) {
      selecciones.push({
        tipo: mercado.tipo,
        valor: mercado.valor,
        linea: mercado.linea,
        estado: 'pendiente',
        raw: linea
      });
    }

    // Patrones específicos de Bet365 y otros
    const patronOverUnder = /(over|under)\s*(\d+\.?\d*)/i;
    const match = lower.match(patronOverUnder);
    if (match) {
      const tipo = match[1].toLowerCase() === 'over' ? 'goles_over' : 'goles_under';
      selecciones.push({
        tipo,
        valor: `${match[1]} ${match[2]}`,
        linea: parseFloat(match[2]),
        estado: 'pendiente',
        raw: linea
      });
    }

    // Patrón de cuotas @2.50 o 2.50
    const patronCuota = /([+-]?\d+\.?\d*)\s*@/i;
    if (patronCuota.test(lower)) {
      // Es una cuota, buscar el nombre del mercado associated
      const cuotaMatch = lower.match(patronCuota);
      if (cuotaMatch && selectionsNoEstaDuplicado(selecciones, linea)) {
        // Intentar normalizar el resto de la línea
        const sinCuota = lower.replace(patronCuota, '').trim();
        const mercado = normalizarMercado(sinCuota || linea);
        if (mercado.normalizado || sinCuota.length > 2) {
          selecciones.push({
            tipo: mercado.tipo,
            valor: sinCuota || linea,
            linea: mercado.linea,
            cuota: parseFloat(cuotaMatch[1]),
            estado: 'pendiente',
            raw: linea
          });
        }
      }
    }
  }

  return selecciones;
}

/**
 * Helper para evitar duplicados
 */
function selectionsNoEstaDuplicado(selecciones, linea) {
  return !selecciones.some(s => s.raw === linea);
}

/**
 * Calcula la confianza de la extracción
 */
function calcularConfianza(apuesta, lineas) {
  let score = 0;
  let maxScore = 0;

  // Partido detectado: +30
  maxScore += 30;
  if (apuesta.partido) score += 30;

  // Marcador detectado: +20
  maxScore += 20;
  if (apuesta.marcador.local !== null) score += 20;

  // Selecciones encontradas: +10 por cada una (max 30)
  maxScore += 30;
  score += Math.min(apuesta.selecciones.length * 10, 30);

  // Minuto detectado: +10
  maxScore += 10;
  if (apuesta.minuto !== null) score += 10;

  // Al menos una línea con texto: +10
  maxScore += 10;
  if (lineas.length > 0) score += 10;

  return score / maxScore;
}

/**
 * Busca el partido real en la API usando los equipos detectados
 * @param {object} partido - { local, visitante }
 * @returns {Promise<object|null>}
 */
async function buscarPartidoReal(partido) {
  if (!partido) return null;

  try {
    // Buscar ambos equipos
    const [homeTeam, awayTeam] = await Promise.all([
      cache.getTeamByName(partido.local),
      cache.getTeamByName(partido.visitante)
    ]);

    if (!homeTeam || !awayTeam) {
      console.log('[BetParser] No se encontraron ambos equipos');
      return null;
    }

    // Obtener partidos recientes del home team
    const matches = await cache.getRecentWorldCupMatchesByTeam(homeTeam.id);

    // Buscar coincidencia con away team
    const match = matches.find(m =>
      m.homeTeam?.toLowerCase().includes(awayTeam.name.toLowerCase()) ||
      m.awayTeam?.toLowerCase().includes(awayTeam.name.toLowerCase())
    );

    if (match) {
      return {
        id: match.id,
        homeTeam: { id: homeTeam.id, name: homeTeam.name },
        awayTeam: { id: awayTeam.id, name: awayTeam.name },
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: match.minute,
        tournament: match.tournament,
        date: match.date
      };
    }

    return null;
  } catch (error) {
    console.error('[BetParser] Error buscando partido:', error);
    return null;
  }
}

/**
 * Convierte ApuestaExtraida a formato JSON
 */
function toJSON(apuesta, matchReal = null) {
  return {
    partido: apuesta.partido ? `${apuesta.partido.local} vs ${apuesta.partido.visitante}` : null,
    partido_detectado: apuesta.partido,
    minuto: apuesta.minuto,
    marcador: apuesta.marcador,
    selecciones: apuesta.selecciones.map(s => ({
      tipo: s.tipo,
      valor: s.valor,
      linea: s.linea,
      estado: s.estado,
      cuota: s.cuota
    })),
    confianza_ocr: apuesta.confianza,
    match_real: matchReal,
    errores: apuesta.errores
  };
}

module.exports = {
  parseBetText,
  buscarPartidoReal,
  toJSON,
  ApuestaExtraida
};
