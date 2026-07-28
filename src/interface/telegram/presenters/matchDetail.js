/**
 * src/interface/telegram/presenters/matchDetail.js — Presentador (Fase 7, Fase 3).
 *
 * El bloque "💡 Más opciones:" con teclado inline de un solo partido que varios
 * comandos de detalle (previa, h2h, stats-vivo, predicciones) envían como segundo
 * mensaje.
 */

const { buildSingleGameKeyboard } = require('./keyboards');

function moreOptions(gameId, actions) {
  return {
    text: '💡 Más opciones:',
    options: { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, actions) } },
  };
}

module.exports = { moreOptions };
