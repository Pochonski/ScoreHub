/**
 * src/interface/telegram/commands/help.js — Comando /help (Fase 7, Fase 2).
 *
 * Texto estático → sin use-case. Solo presenter + envío.
 */

const { helpText } = require('../presenters/staticText');

const TRIGGERS = ['/help', '/ayuda'];

function createHelpCommand({ sendMessage }) {
  return async function help(ctx) {
    await sendMessage(ctx.chatId, helpText());
  };
}

module.exports = { TRIGGERS, createHelpCommand };
