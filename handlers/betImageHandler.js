// Handler principal para procesar imágenes de apuestas
// Auditoría 2026-Q3 Fase 4.2/12.2: logger Pino (legacy WhatsApp usa console
// porque messageHandler.js lo importa sin dep Pino).
const log = require('../utils/logger');
const { pool, testConnection } = require('../database/connection');
const db = require('../database/db');
const ocrService = require('../services/ocrService');
const { parseBetText, buscarPartidoReal, toJSON } = require('../services/betParserService');
const { guardarImagen, generarNombreArchivo } = require('../services/imageStorageService');
const { formatTeamWithFlag } = require('../services/countryFlagsService');
const betTrackingEngine = require('../services/betTrackingEngine');

/**
 * Procesa una imagen de apuesta
 * @param {object} client - Cliente de WhatsApp
 * @param {object} message - Mensaje de WhatsApp
 * @param {object} media - Media descargado
 */
async function procesarImagenApuesta(client, message, media) {
  const userId = message.from;
  const mediaBuffer = media.data;

  async function safeReply(text) {
    try {
      await message.reply(text);
    } catch (error) {
      if (error.message?.includes('Execution context') ||
          error.message?.includes('Protocol error') ||
          error.message?.includes('target closed')) {
        log.warn('WhatsApp disconnected, response not sent');
      } else {
        log.error({ err: error }, 'Error sending message');
      }
    }
  }

  // Verificar conexión a BD
  const dbOk = await testConnection();
  if (!dbOk) {
    await safeReply(
      '⚠️ No hay conexión a la base de datos.\n\n' +
      'El módulo de apuestas requiere base de datos activa.\n' +
      'Intenta más tarde.'
    );
    return;
  }

  try {
    // 1. OCR - Extraer texto de la imagen
    await safeReply('🔍 Analizando imagen...');

    const ocrResult = await ocrService.procesarImagen(mediaBuffer);
    const textoExtraido = ocrResult.text;

    if (!textoExtraido || textoExtraido.trim().length < 10) {
      await safeReply(
        '⚠️ No pude leer texto en la imagen.\n\n' +
        'Asegúrate de que:\n' +
        '• La imagen sea clara y legible\n' +
        '• Contenga texto de una apuesta deportiva\n' +
        '• No esté muy oscura o borrosa'
      );
      return;
    }

    // 2. Parsear texto a estructura
    await safeReply('📋 Extrayendo datos de la apuesta...');

    const apuestaExtraida = parseBetText(textoExtraido);
    const datosApuesta = toJSON(apuestaExtraida);

    // 2b. Umbral de confianza: si el OCR no es fiable, no persistir.
    const MIN_CONFIDENCE = parseFloat(process.env.OCR_MIN_CONFIDENCE || '0.5');
    const confianza = ocrResult.confidence || datosApuesta.confianza_ocr || 0;
    if (confianza < MIN_CONFIDENCE) {
      await safeReply(
        `⚠️ La imagen no tiene suficiente calidad para procesar (confianza ${(confianza * 100).toFixed(0)}%, mínimo ${(MIN_CONFIDENCE * 100).toFixed(0)}%).\n\n` +
        'Probá con una captura más nítida y bien iluminada.'
      );
      return;
    }

    // 3. Verificar que se detectó un partido
    if (!datosApuesta.partido_detectado) {
      await safeReply(
        '⚠️ No pude identificar el partido en la imagen.\n\n' +
        'Asegúrate de que la imagen muestre claramente:\n' +
        '• Los nombres de los equipos (ej: "Brasil vs Argentina")\n' +
        '• El marcador actual\n\n' +
        'Intenta con otra imagen.'
      );
      return;
    }

    // 4. Buscar el partido real en la API
    await safeReply('🔎 Buscando partido en la API...');

    const partidoReal = await buscarPartidoReal(datosApuesta.partido_detectado);

    let idPartidoApi = null;
    let infoPartido = '';

    if (partidoReal) {
      idPartidoApi = partidoReal.id;
      infoPartido =
        `✅ Partido encontrado:\n` +
        `⚽ ${formatTeamWithFlag(partidoReal.homeTeam.name)} vs ${formatTeamWithFlag(partidoReal.awayTeam.name)}\n` +
        `📊 ${partidoReal.homeScore || 0} - ${partidoReal.awayScore || 0}\n` +
        `🏆 ${partidoReal.tournament || 'Partido'}`;
    } else {
      infoPartido =
        `⚠️ No encontré el partido en la API.\n` +
        `📝 Partido detectado: ${datosApuesta.partido}\n\n` +
        `La apuesta se guardará pero el seguimiento en tiempo real no estará disponible.`;
    }

    // 5. Guardar en base de datos (primero para obtener ID)
    await safeReply('💾 Guardando apuesta...');

    const result = await db.execAdvanced(`
      INSERT INTO apuestas (
        id_usuario,
        partido_extrado,
        minuto_extrado,
        marcador_local,
        marcador_visitante,
        id_partido_api,
        partido_normalizado,
        confianza_ocr,
        fecha_partido
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      userId,
      datosApuesta.partido,          // partido_extrado: texto raw del OCR
      datosApuesta.minuto,
      datosApuesta.marcador?.local,
      datosApuesta.marcador?.visitante,
      idPartidoApi,
      partidoReal ? `${partidoReal.homeTeam.name} vs ${partidoReal.awayTeam.name}` : datosApuesta.partido, // partido_normalizado
      datosApuesta.confianza_ocr,
      partidoReal?.date || null
    ]);

    const apuestaId = result.rows[0].id;

    // Guardar imagen en filesystem y obtener URL
    const filename = generarNombreArchivo(apuestaId, media.mimetype);
    const imageUrl = guardarImagen(mediaBuffer, filename);

    // Actualizar con URL de imagen
    await db.execAdvanced(`
      UPDATE apuestas SET imagen_url = $1 WHERE id = $2
    `, [imageUrl, apuestaId]);

    // 6. Guardar selecciones
    if (datosApuesta.selecciones.length > 0) {
      for (const sel of datosApuesta.selecciones) {
        await db.execAdvanced(`
          INSERT INTO apuesta_selecciones (
            id_apuesta, tipo_mercado, valor_seleccion, linea, estado
          ) VALUES ($1, $2, $3, $4, $5)
        `, [apuestaId, sel.tipo, sel.valor, sel.linea, sel.estado]);
      }
    }

    // 7. Resumen para el usuario
    const resumen =
      `📸 *APUESTA GUARDADA*\n\n` +
      `${infoPartido}\n\n` +
      `📋 *Selecciones (${datosApuesta.selecciones.length}):*\n`;

    datosApuesta.selecciones.forEach((sel, i) => {
      resumen += `${i + 1}. ${sel.valor} (${sel.tipo})\n`;
    });

    resumen +=
      `\n📊 Confianza OCR: ${(datosApuesta.confianza_ocr * 100).toFixed(0)}%\n\n` +
      `🔔 Recibirás notificaciones cuando se cumplan o fallen las selecciones.`;

    await safeReply(resumen);

    // 8. Iniciar tracking si hay partido real
    if (idPartidoApi && !betTrackingEngine.isRunning()) {
      betTrackingEngine.iniciar(60); // 60 segundos
      await safeReply('✅ Sistema de seguimiento activado (actualización cada 60s)');
    }

  } catch (error) {
    log.error({ err: error }, 'Error procesando imagen');
    await safeReply(
      '⚠️ Ocurrió un error procesando la imagen.\n\n' +
      'Error: ' + error.message
    );
  }
}

/**
 * Obtiene las apuestas de un usuario
 */
async function getApuestasUsuario(userId) {
  const result = await db.execAdvanced(`
    SELECT a.*,
           json_agg(s.*) FILTER (WHERE s.id IS NOT NULL) as selecciones
    FROM apuestas a
    LEFT JOIN apuesta_selecciones s ON s.id_apuesta = a.id
    WHERE a.id_usuario = $1
    GROUP BY a.id
    ORDER BY a.fecha_creacion DESC
  `, [userId]);

  return result.rows;
}

/**
 * Muestra el estado de una apuesta
 */
function formatearApuesta(apuesta) {
  const emoji = apuesta.estado === 'abierta' ? '🔄' : apuesta.resultado_final === 'ganada' ? '🎉' : '❌';

  let msg = `${emoji} *APUESTA #${apuesta.id}*\n\n`;
  msg += `⚽ ${apuesta.partido_normalizado}\n`;
  msg += `📊 Marcador: ${apuesta.marcador_local || '?'} - ${apuesta.marcador_visitante || '?'}\n`;
  msg += `Estado: ${apuesta.estado}\n\n`;

  if (apuesta.selecciones && apuesta.selecciones.length > 0) {
    msg += `📋 *Selecciones:*\n`;
    apuesta.selecciones.forEach(s => {
      const estadoEmoji = s.estado === 'cumplida' ? '✅' : s.estado === 'fallida' ? '❌' : '⏳';
      msg += `${estadoEmoji} ${s.valor_seleccion} (${s.tipo_mercado})\n`;
    });
  }

  return msg;
}

module.exports = {
  procesarImagenApuesta,
  getApuestasUsuario,
  formatearApuesta
};
