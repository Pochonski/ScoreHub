/**
 * src/interface/telegram/presenters/matchMessages.js — Presentadores (Fase 7, Fase 2).
 *
 * Convierten el resultado de un use-case en `{ text, options }` para
 * `sendMessage`. `options` es `undefined` cuando no hay teclado (equivalente a
 * llamar `sendMessage(chatId, text)` — el default de options es `{}`).
 */

const { buildGameKeyboard } = require('./keyboards');

function liveMatchesMessage({ text, games }) {
  if (games && games.length > 0) {
    return { text, options: { reply_markup: { inline_keyboard: buildGameKeyboard(games, ['stats', 'odds']) } } };
  }
  return { text, options: undefined };
}

function fixtureMessage({ text, games }) {
  if (games.length) {
    return { text, options: { reply_markup: { inline_keyboard: buildGameKeyboard(games, ['odds']) } } };
  }
  return { text, options: undefined };
}

module.exports = { liveMatchesMessage, fixtureMessage };
