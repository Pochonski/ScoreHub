// Servicio de notificaciones WhatsApp para apuestas
// Auditoría 2026-Q3 Fase 12.2: logger Pino.
const log = require('../utils/logger');
const { pool } = require('../database/connection');
const db = require('../database/db');
const { getFlag, formatTeamWithFlag } = require('./countryFlagsService');

let whatsappClient = null;

// Personalidad del bot - saludo entusiasta
const PERSONALIDAD = {
  saludo: '¡Vamos que vamos! 🔥',
  exclamaciones: ['¡Esto está que arde!', '¡No me lo puedo creer!', '¡Increíble!', '¡Qué partidazo!', '¡Momento histórico!'],
};

/**
 * Configura el cliente de WhatsApp para enviar notificaciones
 * @param {object} client - Cliente de whatsapp-web.js
 */
function setClient(client) {
  whatsappClient = client;
}

/**
 * Emoji para cada tipo de mercado
 */
const EMOJIS = {
  'resultado_final': '🏆',
  'resultado_primer_tiempo': '⏱️',
  'goles_over': '⚽',
  'goles_under': '🧤',
  'corners_over': '📐',
  'corners_under': '📊',
  'tarjetas_over': '🟨',
  'tarjetas_under': '🟥',
  'ambos_marcan': '✅',
  'ambos_no_marcan': '❌',
  'tiros_over': '🎯',
  'tiros_under': '🛡️',
  'posesion_over': '📈',
  'posesion_under': '📉',
  'handicap_local': '➖',
  'handicap_visitante': '➕',
  'gol': '⚽',
  'corner': '📐',
  'tarjeta': '🟨',
  'penalty': '⚽',
  'default': '📋'
};

/**
 * Obtiene el emoji para un tipo de evento
 */
function getEmoji(tipo) {
  return EMOJIS[tipo] || EMOJIS.default;
}

/**
 * Envía una notificación a un usuario
 */
async function enviarNotificacion(userId, mensaje) {
  if (!whatsappClient) {
    log.warn('NotificationService: WhatsApp client no configurado');
    return false;
  }

  try {
    await whatsappClient.sendMessage(userId, mensaje);
    log.info({ userId }, 'NotificationService: enviado');
    return true;
  } catch (error) {
    log.error({ err: error }, 'NotificationService: error enviando');
    return false;
  }
}

/**
 * Formatea el valor de una selección añadiendo banderas si es un equipo
 */
function formatearValorConFlag(valor, tipo) {
  if (!valor) return valor;

  // Para resultado_final, intentar añadir flags a nombres de equipos
  if (tipo === 'resultado_final') {
    // Palabras que NO son equipos
    const noEquipos = ['local', 'home', 'visitante', 'away', 'empate', 'draw', 'tie', 'x'];
    const valorLower = valor.toLowerCase().trim();

    if (noEquipos.includes(valorLower)) {
      return valor;
    }

    // Es probablemente un nombre de equipo
    return formatTeamWithFlag(valor);
  }

  // Para handicap, el valor puede contener un equipo
  if (tipo === 'handicap_local' || tipo === 'handicap_visitante') {
    return formatTeamWithFlag(valor);
  }

  return valor;
}

/**
 * Notifica que una selección fue cumplida
 */
async function notificarSeleccionCumplida(userId, seleccion, apuesta) {
  const emoji = getEmoji(seleccion.tipo);
  const valorFormateado = formatearValorConFlag(seleccion.valor, seleccion.tipo);
  const exclamacion = PERSONALIDAD.exclamaciones[Math.floor(Math.random() * PERSONALIDAD.exclamaciones.length)];
  const msg =
    `${emoji} ¡¡¡ ${exclamacion} 🔥 !!!\n\n` +
    `📋 Tu selección: *${valorFormateado}*\n` +
    `📏 Línea: ${seleccion.linea || 'N/A'}\n\n` +
    `✅ *¡CUMPLIDA!*`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica que una selección falló
 */
async function notificarSeleccionFallida(userId, seleccion, apuesta) {
  const emoji = getEmoji(seleccion.tipo);
  const valorFormateado = formatearValorConFlag(seleccion.valor, seleccion.tipo);
  const msg =
    `${emoji} *No fue esta vez...*\n\n` +
    `📋 Tu selección: ${valorFormateado}\n` +
    `📏 Línea: ${seleccion.linea || 'N/A'}\n\n` +
    `❌ *Fallida* - ¡Pero viene la próxima! 💪`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica un gol
 */
async function notificarGol(userId, equipo, minuto, marcador) {
  const msg =
    `⚽ *¡¡¡ GOOOOOOOL de ${formatTeamWithFlag(equipo)} !!!*\n\n` +
    `⏱️ *Minuto ${minuto}'*\n` +
    `📊 Marcador: *${marcador.local} - ${marcador.visitante}*\n\n` +
    `🔥 ¡¡El partido está que arde!!`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica un córner
 */
async function notificarCorner(userId, equipo, minuto, totalCorners) {
  const msg =
    `📐 *¡¡¡ CÓRNER de ${formatTeamWithFlag(equipo)} !!!*\n\n` +
    `⏱️ Minuto ${minuto}'\n` +
    `📊 Total córners: *${totalCorners}*`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica una tarjeta
 */
async function notificarTarjeta(userId, equipo, tipo, minuto) {
  const emoji = tipo === 'yellow' ? '🟨' : '🟥';
  const tipoTexto = tipo === 'yellow' ? 'AMARILLA' : '🟥 ROJA';
  const gravedad = tipo === 'red' ? '¡Tarjeta roja! ¡Esto se pone interesante!' : '¡Cuidado que se acumula!';

  const msg =
    `${emoji} *${tipoTexto} para ${formatTeamWithFlag(equipo)}!*\n\n` +
    `⏱️ Minuto ${minuto}'\n` +
    `${gravedad}`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica cambio de marcador
 */
async function notificarCambioMarcador(userId, nuevoMarcador, minuto) {
  const msg =
    `📢 *¡¡¡ CAMBIO DE MARCADOR !!!*\n\n` +
    `⏱️ *Minuto ${minuto}'*\n` +
    `📊 Nuevo marcador: *${nuevoMarcador.local} - ${nuevoMarcador.visitante}*\n\n` +
    `🔥 ¡El partido está interesante!`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica inicio de partido
 */
async function notificarInicioPartido(userId, partido, hora) {
  const msg =
    `🏁 *¡¡¡ ARRANCÓ EL PARTIDAZO !!!*\n\n` +
    `⚽ ${formatTeamWithFlag(partido.homeTeam?.name || 'Local')} vs ${formatTeamWithFlag(partido.awayTeam?.name || 'Visitante')}\n` +
    `🕐 Hora: ${hora}\n` +
    `🏆 ${partido.tournament || 'Partido'}\n\n` +
    `¡Que empiece la función! 🤩`;

  return enviarNotificacion(userId, msg);
}

/**
 * Notifica fin de partido y resultado de la apuesta
 */
async function notificarFinApuesta(userId, apuesta, resultado) {
  const emoji = resultado === 'ganada' ? '🎉' : resultado === 'perdida' ? '😔' : '🤝';
  let msg;

  if (resultado === 'ganada') {
    msg =
      `${emoji} *¡¡¡ ENHORABUENA !!!* 🎉🎉🎉\n\n` +
      `Tu apuesta fue *ganadora*!\n` +
      `📋 ${addFlagsToText(apuesta.partido_normalizado)}\n` +
      `📊 Resultado final: *${apuesta.marcador_local || '?'} - ${apuesta.marcador_visitante || '?'}*\n\n` +
      `¡Eso es mi gente! 💰🔥`;
  } else if (resultado === 'perdida') {
    msg =
      `${emoji} *¡No fue esta vez!*\n\n` +
      `Tu apuesta fue *perdedora*\n` +
      `📋 ${addFlagsToText(apuesta.partido_normalizado)}\n` +
      `📊 Resultado final: ${apuesta.marcador_local || '?'} - ${apuesta.marcador_visitante || '?'}\n\n` +
      `¡No te rindas! Mañana es otro día 💪`;
  } else {
    msg =
      `${emoji} *¡Apuesta anulada!*\n\n` +
      `📋 ${addFlagsToText(apuesta.partido_normalizado)}\n` +
      `📊 Resultado: ${apuesta.marcador_local || '?'} - ${apuesta.marcador_visitante || '?'}\n\n` +
      `¡Seguimos!`;
  }

  return enviarNotificacion(userId, msg);
}

/**
 * Registra un evento en la base de datos
 */
async function registrarEvento(apuestaId, tipoEvento, descripcion, datos = {}) {
  try {
    await db.execAdvanced(
      `INSERT INTO eventos_apuesta (id_apuesta, tipo_evento, descripcion, datos)
       VALUES ($1, $2, $3, $4)`,
      [apuestaId, tipoEvento, descripcion, JSON.stringify(datos)]
    );
    return true;
  } catch (error) {
    log.error({ err: error }, 'NotificationService: error registrando evento');
    return false;
  }
}

module.exports = {
  setClient,
  getEmoji,
  enviarNotificacion,
  notificarSeleccionCumplida,
  notificarSeleccionFallida,
  notificarGol,
  notificarCorner,
  notificarTarjeta,
  notificarCambioMarcador,
  notificarInicioPartido,
  notificarFinApuesta,
  registrarEvento
};
