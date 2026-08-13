const intentParser = require('../services/intentParser');
const followHandler = require('./followHandler');
const context = require('../services/conversationContext');

const CONFIDENCE_THRESHOLD = 0.6;

function pickRecentTicket(chatId, fallbackId) {
  if (fallbackId) return fallbackId;
  const tickets = context.getRecentTickets(chatId);
  if (tickets.length === 0) return null;
  return tickets[0];
}

async function handleMessage(chatIdStr, messageText) {
  if (!messageText || !messageText.trim()) return { handled: false };

  const chatContext = context.summarize(chatIdStr);
  const intent = await intentParser.parseIntent(messageText, chatContext);

  if (!intentParser.isConfident(intent)) {
    return { handled: false, intent, message: null };
  }

  switch (intent.intent) {
    case 'follow': {
      let ticketId = intent.ticketId;
      if (!ticketId) ticketId = pickRecentTicket(chatIdStr, null);
      if (!ticketId) {
        return {
          handled: true,
          intent,
          message: '🤔 ¿Qué ticket querés seguir? Decime el número, ej: "sígueme el 555".',
        };
      }
      const mode = intent.mode === 'outcome_only' ? 'outcome_only' : 'all_events';
      const result = await followHandler.followTicket(chatIdStr, ticketId, mode);
      return { handled: true, intent, message: result.message };
    }
    case 'unfollow': {
      const ticketId = intent.ticketId || pickRecentTicket(chatIdStr, null);
      if (!ticketId) {
        return {
          handled: true,
          intent,
          message: '🤔 ¿Qué ticket querés dejar de seguir? Decime el número.',
        };
      }
      const result = await followHandler.unfollowTicket(chatIdStr, ticketId);
      return { handled: true, intent, message: result.message };
    }
    case 'list_followed': {
      const result = await followHandler.listFollowed(chatIdStr);
      return { handled: true, intent, message: result.message };
    }
    case 'change_mode': {
      const ticketId = intent.ticketId || pickRecentTicket(chatIdStr, null);
      if (!ticketId || !intent.mode) {
        return {
          handled: true,
          intent,
          message: '🤔 Necesito el ticket y el modo. Ej: "cambia el 555 a solo cuando gane".',
        };
      }
      const result = await followHandler.changeMode(chatIdStr, ticketId, intent.mode);
      return { handled: true, intent, message: result.message };
    }
    case 'query_stats':
    case 'query_live':
    case 'chat':
    default:
      return { handled: false, intent, message: null };
  }
}

module.exports = { handleMessage, CONFIDENCE_THRESHOLD };