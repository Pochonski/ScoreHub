/**
 * src/application/orchestration/routeIntent.js — Use-case orquestador de intents (Fase 8).
 *
 * Reemplaza `handlers/messageHandler.js` como punto de entrada del bot.
 * Recibe TODOS los use-cases migrados como deps en lugar de importar
 * handlers legacy directamente. El caller inyecta `safeReply` y `saveHistory`
 * como deps para abstraer la plataforma (WhatsApp/Telegram) y el storage.
 *
 * El handler legacy queda como fachada — ningún caller debería seguir
 * importándolo después de esta fase.
 *
 * Cada INTENTOS.X del legacy se mapea 1:1 a una llamada al use-case
 * correspondiente. La constante INTENTOS se mantiene en
 * `utils/constants.js` para no duplicar.
 */

function createRouteIntent({
  useCases,
  INTENTOS,
  safeReply,
  saveHistory,
  logger = console,
}) {
  if (!useCases) throw new Error('createRouteIntent: useCases required');
  if (!INTENTOS) throw new Error('createRouteIntent: INTENTOS required');
  if (!safeReply) throw new Error('createRouteIntent: safeReply required');
  if (!saveHistory) throw new Error('createRouteIntent: saveHistory required');

  return async function routeIntent({ userId, text, parsed }) {
    const { intent, ...rest } = parsed;
    const currentParsed = { ...rest, intent };

    let response;
    try {
      switch (intent) {
        case INTENTOS.PARTIDOS_HOY:
          response = await useCases.matches.partidosHoy();
          break;

        case INTENTOS.PARTIDOS_FECHA:
          response = await useCases.matches.partidosFecha(currentParsed.fecha);
          break;

        case INTENTOS.RESULTADO:
          response = await useCases.matches.resultadoEquipo(currentParsed.equipo);
          break;

        case INTENTOS.RESULTADO_VS:
          response = await useCases.matches.resultadoVS(currentParsed.home, currentParsed.away);
          break;

        case INTENTOS.PROXIMOS:
          response = await useCases.matches.proximosEquipo(currentParsed.equipo);
          break;

        case INTENTOS.INFO_EQUIPO:
          response = await useCases.teams.infoEquipo(currentParsed.equipo);
          break;

        case INTENTOS.ESTADISTICA:
          response = await useCases.teamStats.estadisticas(currentParsed);
          break;

        case INTENTOS.TABLA:
          response = await useCases.standings.tabla(currentParsed.liga);
          break;

        case INTENTOS.TABLA_MUNDIAL:
          response = await useCases.standings.tabla('mundial');
          break;

        case INTENTOS.TABLA_GRUPO:
          response = await useCases.standings.tabla('mundial');
          break;

        case INTENTOS.ANALISIS:
          if (currentParsed.home && currentParsed.away) {
            response = await useCases.betting.analizarEnfrentamiento(currentParsed.home, currentParsed.away);
          } else if (currentParsed.equipo) {
            response = await useCases.betting.analizarEquipo(currentParsed.equipo);
          } else {
            response = '⚠️ Indica dos equipos para analizar. Ej: "Analiza Brasil vs Argentina"';
          }
          break;

        case INTENTOS.SEGUIR_EQUIPO:
          response = await useCases.teams.seguirEquipo(userId, currentParsed.equipo);
          break;

        case INTENTOS.DEJAR_SEGUIR:
          response = await useCases.teams.dejarSeguirEquipo(userId, currentParsed.equipo);
          break;

        case INTENTOS.MIS_EQUIPOS:
          response = await useCases.teams.getEquiposSeguidos(userId);
          break;

        default:
          response = `🤔 No entendí "${text}".\n\nEscribe *ayuda* para ver los comandos disponibles.`;
      }
    } catch (error) {
      logger.error?.({ err: error }, 'Error handling message');
      response = '⚠️ Ocurrió un error procesando tu consulta. Intenta de nuevo.';
    }

    await saveHistory(userId, text, parsed.intent, response);
    await safeReply(response);

    return response;
  };
}

module.exports = { createRouteIntent };
