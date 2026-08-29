/**
 * src/application/bets/processBetImage.js — Use-case de procesamiento de imagen de apuesta (Fase 8).
 *
 * Reemplaza `procesarImagenApuesta` de `handlers/betImageHandler.js`.
 * Orquesta OCR + parser + betRepository + trackingEngine sin acoplarse a
 * la plataforma de entrega (WhatsApp/Telegram) — el caller inyecta un
 * `safeReply(text)` adapter que abstrae el envío.
 *
 * El `safeReply` legacy vivía dentro del closure del handler (capturaba
 * `message` para reply por WhatsApp). Acá se inyecta como dep para que
 * el use-case sea testeable y reutilizable desde cualquier canal.
 */

const MIN_CONFIDENCE_DEFAULT = 0.5;

function buildResumen({ infoPartido, selecciones, confianzaOcr }) {
  let resumen =
    '📸 *APUESTA GUARDADA*\n\n' +
    `${infoPartido}\n\n` +
    `📋 *Selecciones (${selecciones.length}):*\n`;
  selecciones.forEach((sel, i) => {
    resumen += `${i + 1}. ${sel.valor} (${sel.tipo})\n`;
  });
  resumen +=
    `\n📊 Confianza OCR: ${(confianzaOcr * 100).toFixed(0)}%\n\n` +
    '🔔 Recibirás notificaciones cuando se cumplan o fallen las selecciones.';
  return resumen;
}

function createProcessBetImage({
  ocrService,
  parseBetText,
  toJSON,
  buscarPartidoReal,
  formatTeamWithFlag,
  guardarImagen,
  generarNombreArchivo,
  betRepository,
  betTrackingEngine,
  testConnection,
  logger = console,
}) {
  if (!ocrService) throw new Error('createProcessBetImage: ocrService required');
  if (!betRepository) throw new Error('createProcessBetImage: betRepository required');
  if (!parseBetText || !toJSON || !buscarPartidoReal || !guardarImagen || !generarNombreArchivo) {
    throw new Error('createProcessBetImage: parser/storage helpers required');
  }

  return async function processBetImage({ userId, mediaBuffer, mimeType, safeReply }) {
    async function reply(text) {
      try {
        await safeReply(text);
      } catch (error) {
        if (error.message?.includes('Execution context') ||
            error.message?.includes('Protocol error') ||
            error.message?.includes('target closed')) {
          logger.warn?.('Reply channel disconnected');
        } else {
          logger.error?.({ err: error }, 'Error sending reply');
        }
      }
    }

    const dbOk = testConnection ? await testConnection() : true;
    if (!dbOk) {
      await reply(
        '⚠️ No hay conexión a la base de datos.\n\n' +
        'El módulo de apuestas requiere base de datos activa.\n' +
        'Intenta más tarde.'
      );
      return;
    }

    try {
      await reply('🔍 Analizando imagen...');
      const ocrResult = await ocrService.procesarImagen(mediaBuffer);
      const textoExtraido = ocrResult.text;
      if (!textoExtraido || textoExtraido.trim().length < 10) {
        await reply(
          '⚠️ No pude leer texto en la imagen.\n\n' +
          'Asegúrate de que:\n' +
          '• La imagen sea clara y legible\n' +
          '• Contenga texto de una apuesta deportiva\n' +
          '• No esté muy oscura o borrosa'
        );
        return;
      }

      await reply('📋 Extrayendo datos de la apuesta...');
      const apuestaExtraida = parseBetText(textoExtraido);
      const datosApuesta = toJSON(apuestaExtraida);

      const MIN_CONFIDENCE = parseFloat(process.env.OCR_MIN_CONFIDENCE || String(MIN_CONFIDENCE_DEFAULT));
      const confianza = ocrResult.confidence || datosApuesta.confianza_ocr || 0;
      if (confianza < MIN_CONFIDENCE) {
        await reply(
          `⚠️ La imagen no tiene suficiente calidad para procesar (confianza ${(confianza * 100).toFixed(0)}%, mínimo ${(MIN_CONFIDENCE * 100).toFixed(0)}%).\n\n` +
          'Probá con una captura más nítida y bien iluminada.'
        );
        return;
      }

      if (!datosApuesta.partido_detectado) {
        await reply(
          '⚠️ No pude identificar el partido en la imagen.\n\n' +
          'Asegúrate de que la imagen muestre claramente:\n' +
          '• Los nombres de los equipos (ej: "Brasil vs Argentina")\n' +
          '• El marcador actual\n\n' +
          'Intenta con otra imagen.'
        );
        return;
      }

      await reply('🔎 Buscando partido en la API...');
      const partidoReal = await buscarPartidoReal(datosApuesta.partido_detectado);

      let idPartidoApi = null;
      let infoPartido = '';
      if (partidoReal) {
        idPartidoApi = partidoReal.id;
        infoPartido =
          '✅ Partido encontrado:\n' +
          `⚽ ${formatTeamWithFlag(partidoReal.homeTeam.name)} vs ${formatTeamWithFlag(partidoReal.awayTeam.name)}\n` +
          `📊 ${partidoReal.homeScore || 0} - ${partidoReal.awayScore || 0}\n` +
          `🏆 ${partidoReal.tournament || 'Partido'}`;
      } else {
        infoPartido =
          '⚠️ No encontré el partido en la API.\n' +
          `📝 Partido detectado: ${datosApuesta.partido}\n\n` +
          'La apuesta se guardará pero el seguimiento en tiempo real no estará disponible.';
      }

      await reply('💾 Guardando apuesta...');
      const inserted = await betRepository.insert({
        idUsuario: userId,
        partidoExtrado: datosApuesta.partido,
        minutoExtrado: datosApuesta.minuto,
        marcadorLocal: datosApuesta.marcador?.local,
        marcadorVisitante: datosApuesta.marcador?.visitante,
        idPartidoApi,
        partidoNormalizado: partidoReal ? `${partidoReal.homeTeam.name} vs ${partidoReal.awayTeam.name}` : datosApuesta.partido,
        confianzaOcr: datosApuesta.confianza_ocr,
        fechaPartido: partidoReal?.date || null,
      });
      const apuestaId = inserted.id;

      const filename = generarNombreArchivo(apuestaId, mimeType);
      const imageUrl = guardarImagen(mediaBuffer, filename);
      await betRepository.setImagenUrl(apuestaId, imageUrl);

      if (datosApuesta.selecciones.length > 0) {
        for (const sel of datosApuesta.selecciones) {
          await betRepository.insertSelection({
            idApuesta: apuestaId,
            tipoMercado: sel.tipo,
            valorSeleccion: sel.valor,
            linea: sel.linea,
            estado: sel.estado,
          });
        }
      }

      await reply(buildResumen({
        infoPartido,
        selecciones: datosApuesta.selecciones,
        confianzaOcr: datosApuesta.confianza_ocr,
      }));

      if (idPartidoApi && betTrackingEngine && !betTrackingEngine.isRunning()) {
        betTrackingEngine.iniciar(60);
        await reply('✅ Sistema de seguimiento activado (actualización cada 60s)');
      }
    } catch (error) {
      logger.error?.({ err: error }, 'Error procesando imagen');
      await reply(
        '⚠️ Ocurrió un error procesando la imagen.\n\n' +
        'Error: ' + error.message
      );
    }
  };
}

function createGetApuestasUsuario({ betRepository }) {
  if (!betRepository) throw new Error('createGetApuestasUsuario: betRepository required');
  return (userId) => betRepository.listByUser(userId);
}

function createFormatearApuesta() {
  return function formatearApuesta(apuesta) {
    const emoji = apuesta.estado === 'abierta' ? '🔄' : apuesta.resultadoFinal === 'ganada' ? '🎉' : '❌';

    let msg = `${emoji} *APUESTA #${apuesta.id}*\n\n`;
    msg += `⚽ ${apuesta.partidoNormalizado}\n`;
    msg += `📊 Marcador: ${apuesta.marcadorLocal || '?'} - ${apuesta.marcadorVisitante || '?'}\n`;
    msg += `Estado: ${apuesta.estado}\n\n`;

    if (apuesta.selecciones && apuesta.selecciones.length > 0) {
      msg += '📋 *Selecciones:*\n';
      apuesta.selecciones.forEach((s) => {
        const estadoEmoji = s.estado === 'cumplida' ? '✅' : s.estado === 'fallida' ? '❌' : '⏳';
        msg += `${estadoEmoji} ${s.valorSeleccion} (${s.tipoMercado})\n`;
      });
    }
    return msg;
  };
}

module.exports = {
  createProcessBetImage,
  createGetApuestasUsuario,
  createFormatearApuesta,
};
