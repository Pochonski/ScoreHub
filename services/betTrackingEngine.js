// Motor de seguimiento de apuestas en tiempo real (CANÓNICO ACTUAL).
//
// NOTA: este es el motor vigente del path de WhatsApp (cron, cada 60s).
// Existe otro motor más nuevo, `services/betEvaluator.js` (event-driven, con
// semántica PUSH correcta), hoy dormido tras ENABLE_LIVE_NOTIFIER=false.
// La consolidación está pendiente; ver docs/bet-evaluation.md antes de
// cambiar cualquiera de los dos.
const cron = require('node-cron');
const { pool } = require('../database/connection');
const db = require('../database/db');
const cache = require('./mundialCache');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

let trackingJob = null;
let isRunning = false;

/**
 * Inicia el motor de seguimiento
 * @param {number} intervalSeconds - Intervalo de verificación en segundos (default: 60)
 */
function iniciar(intervalSeconds = 60) {
  if (trackingJob) {
    logger.info('[BetTracking] Motor ya está corriendo');
    return;
  }

  // Convertir segundos a expresión cron (máximo cada segundo)
  // Para intervalos > 60s, usamos un job cada minuto
  const cronExpr = intervalSeconds >= 60
    ? `*/${Math.floor(intervalSeconds / 60)} * * * *`
    : '* * * * * *';

  console.log(`[BetTracking] Iniciando motor (cada ${intervalSeconds}s)`);

  trackingJob = cron.schedule(cronExpr, async () => {
    if (isRunning) {
      logger.info('[BetTracking] Saltando ciclo - anterior aún en proceso');
      return;
    }
    await cicloEvaluacion();
  });

  console.log(`[BetTracking] Motor iniciado con cron: ${cronExpr}`);
}

/**
 * Detiene el motor de seguimiento
 */
function detener() {
  if (trackingJob) {
    trackingJob.stop();
    trackingJob = null;
    logger.info('[BetTracking] Motor detenido');
  }
}

/**
 * Ciclo principal de evaluación
 */
async function cicloEvaluacion() {
  isRunning = true;
  const startTime = Date.now();

  try {
    // Obtener apuestas abiertas
    const apuestas = await obtenerApuestasAbiertas();

    if (apuestas.length === 0) {
      return;
    }

    console.log(`[BetTracking] Evaluando ${apuestas.length} apuestas...`);

    for (const apuesta of apuestas) {
      try {
        await evaluarApuesta(apuesta);
      } catch (error) {
        logger.error({ err: error.message, apuestaId: apuesta.id }, 'BetTracking error evaluating bet');
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[BetTracking] Ciclo completado en ${duration}ms`);
  } finally {
    isRunning = false;
  }
}

/**
 * Obtiene todas las apuestas abiertas
 */
async function obtenerApuestasAbiertas() {
  const result = await db.execAdvanced(`
    SELECT a.*,
           json_agg(
             json_build_object(
               'id', s.id,
               'tipo', s.tipo_mercado,
               'valor', s.valor_seleccion,
               'linea', s.linea,
               'estado', s.estado,
               'valor_actual', s.valor_actual
             )
           ) FILTER (WHERE s.id IS NOT NULL) as selecciones
    FROM apuestas a
    LEFT JOIN apuesta_selecciones s ON s.id_apuesta = a.id
    WHERE a.estado = 'abierta' AND a.id_partido_api IS NOT NULL
    GROUP BY a.id
    ORDER BY a.fecha_creacion ASC
  `);

  return result;
}

/**
 * Evalúa una apuesta individual
 */
async function evaluarApuesta(apuesta) {
  // Obtener estadísticas actuales del partido
    const stats = await cache.getMatchStats(apuesta.id_partido_api);

  if (!stats) {
    console.log(`[BetTracking] No se pudieron obtener stats para apuesta ${apuesta.id}`);
    return;
  }

  // Verificar si el partido terminó
  if (stats.matchEnded) {
    await cerrarApuesta(apuesta, stats);
    return;
  }

  // Evaluar cada selección
  const seleccionesPendientes = apuesta.selecciones.filter(s => s.estado === 'pendiente');

  for (const seleccion of seleccionesPendientes) {
    const resultado = evaluarSeleccion(seleccion, stats, apuesta);

    if (resultado !== 'pendiente') {
      await actualizarEstadoSeleccion(seleccion.id, resultado, getValorActual(seleccion, stats));
      await notificationService.registrarEvento(
        apuesta.id,
        resultado === 'cumplida' ? 'seleccion_cumplida' : 'seleccion_fallida',
        `${seleccion.tipo}: ${seleccion.valor} - ${resultado}`,
        { seleccion, stats }
      );

      // Notificar al usuario
      if (resultado === 'cumplida') {
        await notificationService.notificarSeleccionCumplida(apuesta.id_usuario, seleccion, apuesta);
      } else {
        await notificationService.notificarSeleccionFallida(apuesta.id_usuario, seleccion, apuesta);
      }
    }
  }

  // Verificar si todas las selecciones están resueltas
  await verificarApuestaCompleta(apuesta.id);
}

/**
 * Evalúa una selección individual
 */
function evaluarSeleccion(seleccion, stats, apuesta) {
  const tipo = seleccion.tipo;
  const linea = seleccion.linea;

  switch (tipo) {
    case 'corners_over':
      return stats.totalCorners >= linea ? 'cumplida' : 'pendiente';

    case 'corners_under':
      return stats.totalCorners <= linea ? 'cumplida' : 'pendiente';

    case 'goles_over':
      return stats.totalGoals >= linea ? 'cumplida' : 'pendiente';

    case 'goles_under':
      return stats.totalGoals <= linea ? 'cumplida' : 'pendiente';

    case 'ambos_marcan':
      return stats.goalsHome > 0 && stats.goalsAway > 0 ? 'cumplida' : 'pendiente';

    case 'ambos_no_marcan':
      return stats.goalsHome === 0 || stats.goalsAway === 0 ? 'cumplida' : 'pendiente';

    case 'resultado_final':
      return evaluarResultadoFinal(seleccion, stats);

    case 'tarjetas_over':
      return stats.totalCards >= linea ? 'cumplida' : 'pendiente';

    case 'tarjetas_under':
      return stats.totalCards <= linea ? 'cumplida' : 'pendiente';

    case 'handicap_local':
      return evaluarHandicap(seleccion, stats, 'home');

    case 'handicap_visitante':
      return evaluarHandicap(seleccion, stats, 'away');

    default:
      return 'pendiente';
  }
}

/**
 * Evalúa resultado final
 */
function evaluarResultadoFinal(seleccion, stats) {
  const valor = seleccion.valor.toLowerCase();

  // "local", "home", el nombre del equipo local
  if (valor.includes('local') || valor.includes('home') || valor.includes(stats.homeTeam?.toLowerCase())) {
    return stats.goalsHome > stats.goalsAway ? 'cumplida' : 'pendiente';
  }

  // "visitante", "away", el nombre del equipo visitante
  if (valor.includes('visitante') || valor.includes('away') || valor.includes(stats.awayTeam?.toLowerCase())) {
    return stats.goalsAway > stats.goalsHome ? 'cumplida' : 'pendiente';
  }

  // "empate", "draw"
  if (valor.includes('empate') || valor.includes('draw') || valor.includes('tie')) {
    return stats.goalsHome === stats.goalsAway ? 'cumplida' : 'pendiente';
  }

  return 'pendiente';
}

/**
 * Evalúa handicap
 */
function evaluarHandicap(seleccion, stats, side) {
  const linea = parseFloat(seleccion.linea) || 0;
  const goalsHome = stats.goalsHome || 0;
  const goalsAway = stats.goalsAway || 0;

  if (side === 'home') {
    const adjustedHome = goalsHome - linea;
    return adjustedHome > goalsAway ? 'cumplida' : 'pendiente';
  } else {
    const adjustedAway = goalsAway - linea;
    return adjustedAway > goalsHome ? 'cumplida' : 'pendiente';
  }
}

/**
 * Obtiene el valor actual para una selección
 */
function getValorActual(seleccion, stats) {
  switch (seleccion.tipo) {
    case 'corners_over':
    case 'corners_under':
      return stats.totalCorners || 0;
    case 'goles_over':
    case 'goles_under':
      return stats.totalGoals || 0;
    case 'ambos_marcan':
      return (stats.goalsHome > 0 && stats.goalsAway > 0) ? 1 : 0;
    case 'tarjetas_over':
    case 'tarjetas_under':
      return stats.totalCards || 0;
    default:
      return null;
  }
}

/**
 * Actualiza el estado de una selección
 */
async function actualizarEstadoSeleccion(seleccionId, nuevoEstado, valorActual) {
  await db.execAdvanced(
    `UPDATE apuesta_selecciones SET estado = $1, valor_actual = $2 WHERE id = $3`,
    [nuevoEstado, valorActual, seleccionId]
  );
}

/**
 * Verifica si una apuesta está completa (todas las selecciones resueltas)
 */
async function verificarApuestaCompleta(apuestaId) {
  const result = await db.execAdvanced(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE estado != 'pendiente') as resueltas
    FROM apuesta_selecciones
    WHERE id_apuesta = $1
  `, [apuestaId]);

  if (result[0].total === result[0].resueltas) {
    await db.execAdvanced(
      `UPDATE apuestas SET estado = 'completada', fecha_cierre = NOW() WHERE id = $1`,
      [apuestaId]
    );
    console.log(`[BetTracking] Apuesta ${apuestaId} completada`);
  }
}

/**
 * Cierra una apuesta cuando termina el partido
 */
async function cerrarApuesta(apuesta, stats) {
  // Actualizar marcador final
  await db.execAdvanced(`
    UPDATE apuestas SET
      estado = 'completada',
      marcador_local = $1,
      marcador_visitante = $2,
      fecha_cierre = NOW()
    WHERE id = $3
  `, [stats.goalsHome, stats.goalsAway, apuesta.id]);

  // Obtener selecciones pendientes y evaluarlas correctamente
  const result = await db.execAdvanced(`
    SELECT * FROM apuesta_selecciones
    WHERE id_apuesta = $1 AND estado = 'pendiente'
  `, [apuesta.id]);

  // Evaluar cada seleccion pendiente antes de marcar
  for (const seleccion of result) {
    const resultado = evaluarSeleccion(seleccion, stats, apuesta);
    await db.execAdvanced(`
      UPDATE apuesta_selecciones SET estado = $1
      WHERE id = $2
    `, [resultado, seleccion.id]);
  }

  // Notificar fin
  await notificationService.notificarFinApuesta(
    apuesta.id_usuario,
    { ...apuesta, marcador_local: stats.goalsHome, marcador_visitante: stats.goalsAway },
    'completada'
  );
}

/**
 * Obtiene estadísticas de una apuesta para evaluación
 */
function parseStatsResponse(statsResponse) {
  // La API devuelve stats con estructura específica
  // Necesitamos normalizar a un formato común
  const stats = {
    goalsHome: 0,
    goalsAway: 0,
    totalGoals: 0,
    totalCorners: 0,
    totalCards: 0,
    homeCorners: 0,
    awayCorners: 0,
    homeCards: 0,
    awayCards: 0,
    matchEnded: false
  };

  if (!statsResponse) return stats;

  // Parsear según la estructura de la API
  // Asumimos que viene como objeto con claves tipo "Corner kicks", "Ball possession", etc.
  for (const [key, value] of Object.entries(statsResponse)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('corner')) {
      stats.totalCorners = parseInt(value.home || 0) + parseInt(value.away || 0);
      stats.homeCorners = parseInt(value.home || 0);
      stats.awayCorners = parseInt(value.away || 0);
    }

    if (lowerKey.includes('yellow card')) {
      stats.totalCards += parseInt(value.home || 0) + parseInt(value.away || 0);
      stats.homeCards = parseInt(value.home || 0);
      stats.awayCards = parseInt(value.away || 0);
    }

    if (lowerKey.includes('red card')) {
      stats.totalCards += parseInt(value.home || 0) + parseInt(value.away || 0);
    }
  }

  return stats;
}

module.exports = {
  iniciar,
  detener,
  cicloEvaluacion,
  evaluarApuesta,
  evaluarSeleccion,
  parseStatsResponse,
  isRunning: () => isRunning
};
