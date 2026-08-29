/**
 * src/application/bets/conversationalFollow.js — Use-case de intents NL de follow (Fase 8).
 *
 * Reemplaza `handlers/conversationalHandler.js`. Recibe el `intentParser`,
 * `followTicketUseCase` y `conversationContext` por inyección. Devuelve
 * `{ handled, intent, message }` igual que el handler legacy para no romper
 * el call site en `telegramBot.js`.
 *
 * El threshold de confianza del parser lo maneja `intentParser.isConfident`;
 * acá sólo despachamos por tipo de intent.
 */

const CONFIDENCE_THRESHOLD = 0.6;

function pickRecentTicket(context, chatId, fallbackId) {
  if (fallbackId) return fallbackId;
  const tickets = context.getRecentTickets(chatId);
  if (tickets.length === 0) return null;
  return tickets[0];
}

function createHandleConversationalMessage({ intentParser, followTicketUseCase, context, logger = console }) {
  if (!intentParser) throw new Error('createHandleConversationalMessage: intentParser required');
  if (!followTicketUseCase) throw new Error('createHandleConversationalMessage: followTicketUseCase required');
  if (!context) throw new Error('createHandleConversationalMessage: context required');

  return async function handleMessage(chatIdStr, messageText) {
    if (!messageText || !messageText.trim()) return { handled: false };

    const chatContext = context.summarize(chatIdStr);
    const intent = await intentParser.parseIntent(messageText, chatContext);

    if (!intentParser.isConfident(intent)) {
      return { handled: false, intent, message: null };
    }

    switch (intent.intent) {
      case 'follow': {
        let ticketId = intent.ticketId;
        if (!ticketId) ticketId = pickRecentTicket(context, chatIdStr, null);
        if (!ticketId) {
          return {
            handled: true,
            intent,
            message: '🤔 ¿Qué ticket querés seguir? Decime el número, ej: "sígueme el 555".',
          };
        }
        const mode = intent.mode === 'outcome_only' ? 'outcome_only' : 'all_events';
        const result = await followTicketUseCase.followTicket(chatIdStr, ticketId, mode);
        return { handled: true, intent, message: result.message };
      }
      case 'unfollow': {
        const ticketId = intent.ticketId || pickRecentTicket(context, chatIdStr, null);
        if (!ticketId) {
          return {
            handled: true,
            intent,
            message: '🤔 ¿Qué ticket querés dejar de seguir? Decime el número.',
          };
        }
        const result = await followTicketUseCase.unfollowTicket(chatIdStr, ticketId);
        return { handled: true, intent, message: result.message };
      }
      case 'list_followed': {
        const result = await followTicketUseCase.listFollowed(chatIdStr);
        return { handled: true, intent, message: result.message };
      }
      case 'change_mode': {
        const ticketId = intent.ticketId || pickRecentTicket(context, chatIdStr, null);
        if (!ticketId || !intent.mode) {
          return {
            handled: true,
            intent,
            message: '🤔 Necesito el ticket y el modo. Ej: "cambia el 555 a solo cuando gane".',
          };
        }
        const result = await followTicketUseCase.changeMode(chatIdStr, ticketId, intent.mode);
        return { handled: true, intent, message: result.message };
      }
      case 'query_stats':
      case 'query_live':
      case 'chat':
      default:
        return { handled: false, intent, message: null };
    }
  };
}

module.exports = {
  createHandleConversationalMessage,
  CONFIDENCE_THRESHOLD,
};
