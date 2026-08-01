/**
 * src/infrastructure/nlu/messageHandlerGateway.js — Adapter del messageHandler
 * legacy (Fase 7, Fase 3).
 *
 * Varios comandos de equipo traducen el slash-command a una frase en lenguaje
 * natural (`body`) y la delegan al `messageHandler` (la ruta NLU legacy), que
 * responde vía el callback `reply`. Este gateway encapsula esa delegación
 * preservando el patrón exacto (mismo `from`/`hasMedia`, mismo callback).
 */

function createMessageHandlerGateway({ messageHandler }) {
  return {
    delegate(chatId, body, reply) {
      return messageHandler(null, { from: chatId.toString(), body, hasMedia: false, reply });
    },
  };
}

module.exports = { createMessageHandlerGateway };
