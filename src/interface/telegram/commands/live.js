/**
 * src/interface/telegram/commands/live.js — Comando /live (Fase 7, Fase 2).
 *
 * Use-case GetLiveMatches → presenter → envío. Sin try/catch: los errores
 * propagan a processMessage (que los reporta), igual que en el legacy.
 */

const { liveMatchesMessage } = require('../presenters/matchMessages');

const TRIGGERS = ['/live', '/envivo'];

function createLiveCommand({ getLiveMatches, sendMessage }) {
  return async function live(ctx) {
    const result = await getLiveMatches();
    const { text, options } = liveMatchesMessage(result);
    await sendMessage(ctx.chatId, text, options);
  };
}

module.exports = { TRIGGERS, createLiveCommand };
