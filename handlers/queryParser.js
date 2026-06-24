// Parser de lenguaje natural → intención
const { INTENTOS, EQUIPOS_POPULARES, LIGAS } = require('../utils/constants');

/**
 * Normaliza texto: minúsculas, elimina acentos y espacios extra
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta el equipo mencionado en el texto (de lista predefinida)
 */
function detectEquipoConocido(text) {
  const normalized = normalize(text);

  for (const [key, equipo] of Object.entries(EQUIPOS_POPULARES)) {
    if (normalized.includes(key)) {
      return { id: equipo.id, nombre: equipo.nombre };
    }
  }

  for (const [key, liga] of Object.entries(LIGAS)) {
    if (normalized.includes(key) || normalized.includes(liga.nombre.toLowerCase())) {
      return { idLiga: liga.id, nombreLiga: liga.nombre };
    }
  }

  return null;
}

/**
 * Extrae un posible nombre de equipo del texto (para búsqueda dinámica)
 */
function extraerNombreEquipo(text) {
  const normalized = normalize(text);

  // Patrones: "Cómo quedó [EQUIPO]" o "[EQUIPO] vs [EQUIPO]"
  const patrones = [
    /quedo\s+(.+?)(?:\s+contra|\s+vs|\s+-|,|$)/i,
    /como\s+quedo\s+(.+?)(?:\s+contra|\s+vs|\s+-|,|$)/i,
    /resultado\s+de\s+(.+?)(?:\s+contra|\s+vs|\s+-|,|$)/i,
    /analiza\s+(.+?)\s+vs\s+(.+)/i,
    /pr[oó]ximo\s+partido\s+de\s+(.+?)(?:\s+|$)/i,
    /info\s+de\s+(.+?)(?:\s+|$)/i,
    /estad[ií]sticas\s+de\s+(.+?)(?:\s+|$)/i
  ];

  for (const patron of patrones) {
    const match = normalized.match(patron);
    if (match) {
      let nombre = (match[1] || match[2] || '').trim();
      // Limpiar palabras comunes
      nombre = nombre.replace(/^(el|la|los|las)\s+/i, '');
      nombre = nombre.replace(/\s*(contra|vs|hoy|mañana|ayer|hoy)\s*$/i, '');
      if (nombre && nombre.length > 2) {
        return nombre;
      }
    }
  }

  return null;
}

/**
 * Detecta si es una fecha relativa
 */
function detectFecha(text) {
  const normalized = normalize(text);

  if (normalized.includes('mañana')) return 'tomorrow';
  if (normalized.includes('pasado mañana')) return 'day_after';
  if (normalized.includes('hoy')) return 'today';
  if (normalized.includes('ayer')) return 'yesterday';
  if (normalized.includes('pasado ayer')) return 'day_before';

  return null;
}

/**
 * Detecta el tipo de estadística solicitada
 */
function detectTipoEstadistica(text) {
  const normalized = normalize(text);

  if (normalized.includes('corner') || normalized.includes('córner') || normalized.includes('corners')) {
    return 'corners';
  }
  if (normalized.includes('tarjeta amarilla') || normalized.includes('tarjetas amarillas')) {
    return 'yellow_cards';
  }
  if (normalized.includes('tarjeta roja') || normalized.includes('tarjetas rojas')) {
    return 'red_cards';
  }
  if (normalized.includes('tiro') || normalized.includes('tiros')) {
    if (normalized.includes('arco') || normalized.includes('puerta')) return 'shots_on_target';
    return 'shots';
  }
  if (normalized.includes('posesión') || normalized.includes('posesion')) {
    return 'possession';
  }
  if (normalized.includes('gol') || normalized.includes('goles')) {
    return 'goals';
  }

  return null;
}

/**
 * Parsea el mensaje y retorna intención + datos
 */
function parse(text) {
  const normalized = normalize(text);
  const original = text;

  // === SALUDOS ===
  if (/^(hola|buenos días|buenas|qué tal|hola!|hi)/i.test(original)) {
    return { intent: INTENTOS.SALUDO };
  }

  // === HELP ===
  if (normalized.includes('ayuda') || normalized.includes('help') || normalized === '?') {
    return { intent: INTENTOS.HELP };
  }

  // === PARTIDOS HOY ===
  if ((normalized.includes('partidos') || normalized.includes('quién juega') || normalized.includes('quien juega')) &&
      (normalized.includes('hoy') || normalized === 'partidos')) {
    return { intent: INTENTOS.PARTIDOS_HOY };
  }

  // === PARTIDOS DE MAÑANA/AYER/FECHA ===
  const fecha = detectFecha(text);
  if (fecha && (normalized.includes('partidos') || normalized.includes('jugadores'))) {
    return { intent: INTENTOS.PARTIDOS_FECHA, fecha };
  }

  // === RESULTADO: "Cómo quedó [equipo]" o "Cuánto quedó [equipo]" ===
  if (normalized.includes('quedó') || normalized.includes('quedo') || normalized.includes('cuanto quedo')) {
    const equipoConocido = detectEquipoConocido(text);
    if (equipoConocido?.id) {
      return { intent: INTENTOS.RESULTADO, equipo: equipoConocido };
    }
    // Intentar extraer nombre de equipo
    const nombreEquipo = extraerNombreEquipo(text);
    if (nombreEquipo) {
      return { intent: INTENTOS.RESULTADO, equipo: { nombre: nombreEquipo }, buscarDinamico: true };
    }
    return { intent: INTENTOS.DESCONOCIDO, original: text };
  }

  // === ANALISIS: "Analiza [equipo] vs [equipo]" - ANTES de RESULTADO VS ===
  if (normalized.includes('analiza') || normalized.includes('apuesta') || normalized.includes('predice')) {
    const vsMatchAnalisis = normalized.match(/([a-záéíóúñ\s]+)\s*(vs|vs\.|-|contra)\s+([a-záéíóúñ\s]+)/);
    if (vsMatchAnalisis) {
      const homeName = vsMatchAnalisis[1].trim().replace(/^analiza\s+/i, '');
      const awayName = vsMatchAnalisis[3].trim();

      let home = null, away = null;
      for (const [key, eq] of Object.entries(EQUIPOS_POPULARES)) {
        if (homeName.includes(key) || key.includes(homeName)) home = eq;
        if (awayName.includes(key) || key.includes(awayName)) away = eq;
      }

      return {
        intent: INTENTOS.ANALISIS,
        home: home || { nombre: homeName, buscarDinamico: true },
        away: away || { nombre: awayName, buscarDinamico: true }
      };
    }

    const equipoConocido = detectEquipoConocido(text);
    if (equipoConocido?.id) {
      return { intent: INTENTOS.ANALISIS, equipo: equipoConocido };
    }
    const nombreEquipo = extraerNombreEquipo(text);
    if (nombreEquipo) {
      return { intent: INTENTOS.ANALISIS, equipo: { nombre: nombreEquipo }, buscarDinamico: true };
    }
  }

  // === RESULTADO VS: "Argentina vs Francia" ===
  const vsMatch = normalized.match(/([a-záéíóúñ\s]+)\s*(vs|vs\.|-|contra)\s+([a-záéíóúñ\s]+)/);
  if (vsMatch) {
    const homeName = vsMatch[1].trim();
    const awayName = vsMatch[3].trim();

    let home = null, away = null;
    for (const [key, eq] of Object.entries(EQUIPOS_POPULARES)) {
      if (homeName.includes(key) || key.includes(homeName)) home = eq;
      if (awayName.includes(key) || key.includes(awayName)) away = eq;
    }

    return {
      intent: INTENTOS.RESULTADO_VS,
      home: home || { nombre: homeName, buscarDinamico: true },
      away: away || { nombre: awayName, buscarDinamico: true }
    };
  }

  // === INFO EQUIPO: "próximo partido de [equipo]", "info de [equipo]" ===
  const equipoConocido = detectEquipoConocido(text);
  if ((normalized.includes('próximo') || normalized.includes('proximo') || normalized.includes('siguiente') ||
       normalized.includes('últimos') || normalized.includes('ultimos') || normalized.includes('resultados') ||
       normalized.includes('info') || normalized.includes('información')) && equipoConocido?.id) {
    return { intent: INTENTOS.INFO_EQUIPO, equipo: equipoConocido };
  }

  // Si dice "info de [equipo]" pero no está en lista
  if (normalized.startsWith('info') || normalized.startsWith('información')) {
    const nombreEquipo = extraerNombreEquipo(text);
    if (nombreEquipo) {
      return { intent: INTENTOS.INFO_EQUIPO, equipo: { nombre: nombreEquipo }, buscarDinamico: true };
    }
  }

  // === ESTADISTICAS ===
  if ((normalized.includes('corner') || normalized.includes('córner') || normalized.includes('tarjeta') ||
       normalized.includes('tiro') || normalized.includes('posesión') || normalized.includes('posesion') ||
       normalized.includes('estadística') || normalized.includes('estadistica'))) {
    if (equipoConocido?.id) {
      return {
        intent: INTENTOS.ESTADISTICA,
        tipo: detectTipoEstadistica(text),
        equipo: equipoConocido
      };
    }
    const nombreEquipo = extraerNombreEquipo(text);
    if (nombreEquipo) {
      return {
        intent: INTENTOS.ESTADISTICA,
        tipo: detectTipoEstadistica(text),
        equipo: { nombre: nombreEquipo },
        buscarDinamico: true
      };
    }
  }

  // === TABLA ===
  if ((normalized.includes('tabla') || normalized.includes('clasificación') || normalized.includes('clasificacion') ||
       normalized.includes('posición') || normalized.includes('posicion'))) {
    // Detectar grupo específico del Mundial
    const grupoMatch = normalized.match(/grupo\s+([a-j])/i);
    if (grupoMatch) {
      return { intent: INTENTOS.TABLA_GRUPO, grupo: grupoMatch[1].toUpperCase() };
    }

    if (normalized.includes('mundial')) {
      return { intent: INTENTOS.TABLA_MUNDIAL };
    }
    if (normalized.includes('premier') || normalized.includes('inglaterra')) {
      return { intent: INTENTOS.TABLA, liga: LIGAS.PREMIER_LEAGUE };
    }
    if (normalized.includes('laliga') || normalized.includes('la liga') || normalized.includes('españa')) {
      return { intent: INTENTOS.TABLA, liga: LIGAS.LA_LIGA };
    }
    return { intent: INTENTOS.TABLA_MUNDIAL };
  }

  // === SEGUIR EQUIPO ===
  if (normalized.startsWith('seguir') || (normalized.includes('siguiente') && normalized.includes('equipo'))) {
    if (equipoConocido?.id) {
      return { intent: INTENTOS.SEGUIR_EQUIPO, equipo: equipoConocido };
    }
    const nombre = extraerNombreEquipo(text);
    if (nombre) {
      return { intent: INTENTOS.SEGUIR_EQUIPO, equipo: { nombre }, buscarDinamico: true };
    }
  }

  // === DEJAR DE SEGUIR ===
  if (normalized.includes('dejar de seguir') || normalized.includes('dejar seguir') || normalized.startsWith('unfollow')) {
    if (equipoConocido?.id) {
      return { intent: INTENTOS.DEJAR_SEGUIR, equipo: equipoConocido };
    }
    const nombre = extraerNombreEquipo(text);
    if (nombre) {
      return { intent: INTENTOS.DEJAR_SEGUIR, equipo: { nombre }, buscarDinamico: true };
    }
  }

  // === MIS EQUIPOS ===
  if (normalized.includes('mis equipos') || normalized.includes('equipos que sigo') || normalized === 'equipos') {
    return { intent: INTENTOS.MIS_EQUIPOS };
  }

  // === INTENTOS DESCONOCIDOS ===
  return { intent: INTENTOS.DESCONOCIDO, original: text };
}

module.exports = { parse, detectEquipoConocido, detectFecha, detectTipoEstadistica, normalize, extraerNombreEquipo };