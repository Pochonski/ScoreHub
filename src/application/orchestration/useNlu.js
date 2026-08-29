/**
 * src/application/orchestration/useNlu.js — Use-case que delega NL al orquestador legacy (Fase 3).
 *
 * Varios comandos slash sintetizan una frase en lenguaje natural
 * (ej: "como quedo Brasil") y la delegan al messageHandler legacy para
 * que la parsee y route. Esto se llama "strangler pattern" — funciona
 * pero acopla los comandos al path legacy.
 *
 * Fase 3 consolida esto detrás de un use-case explícito. Cuando cada
 * comando se refactoree para llamar al use-case final directamente
 * (matches.resultadoEquipo, teams.infoEquipo, etc.) este wrapper queda
 * como no-op. Mientras tanto, centraliza el acceso y elimina la dependencia
 * directa de los comandos sobre `messageHandlerGateway`.
 */

function createUseNlu({ messageHandler, logger = console }) {
  if (!messageHandler) throw new Error('createUseNlu: messageHandler required');

  return {
    /**
     * Delega una frase NL al orquestador legacy.
     * @param {string} chatId
     * @param {string} body       frase NL a parsear
     * @param {(text:string) => Promise<void>} reply  callback que recibe la respuesta
     */
    async delegate(chatId, body, reply) {
      try {
        await messageHandler(null, {
          from: String(chatId),
          body,
          hasMedia: false,
          reply,
        });
      } catch (e) {
        logger.error?.({ err: e.message, body }, 'useNlu.delegate error');
        try {
          await reply('⚠️ No pude procesar tu consulta. Intenta de nuevo.');
        } catch (_) { /* noop */ }
      }
    },
  };
}

module.exports = { createUseNlu };
