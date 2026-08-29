/**
 * src/domain/ports/IConversationContext.js — Puerto de contexto conversacional (Fase 8+).
 *
 * Abstrae el almacenamiento in-memory + file-backed del contexto de
 * conversación (tickets recientemente seguidos, partidos vistos, modo default
 * de notificación por chat). El use-case `conversationalFollow` consume
 * `summarize(chatId)` para enriquecer el intent parser; `followTicket`
 * llama `rememberTicket(chatId, ticketId)` después de cada follow.
 *
 * El adapter (ConversationContextAdapter en infrastructure/conversation/)
 * persiste a un JSON file en database/. Tests pueden inyectar un
 * InMemoryConversationContextAdapter sin tocar el filesystem.
 *
 * @typedef {Object} ConversationContextSummary
 * @property {string[]} recentTickets
 * @property {string[]} recentGames
 * @property {string} [defaultMode]
 * @property {string} [lastInteraction]
 *
 * @typedef {Object} IConversationContext
 * @property {(chatId:string) => ConversationContextSummary|null} summarize
 * @property {(chatId:string, ticketId:string) => void} rememberTicket
 * @property {(chatId:string, gameId:string) => void} rememberGame
 * @property {(chatId:string) => string|null} getDefaultMode
 * @property {(chatId:string, mode:'all_events'|'outcome_only') => void} setDefaultMode
 * @property {(chatId:string) => string[]} getRecentTickets
 * @property {(chatId:string) => string[]} getRecentGames
 * @property {() => void} flushSync
 */

const REQUIRED_METHODS = [
  'summarize',
  'rememberTicket',
  'rememberGame',
  'getDefaultMode',
  'setDefaultMode',
  'getRecentTickets',
  'getRecentGames',
  'flushSync',
];

function createConversationContext(adapter = {}) {
  if (!adapter) {
    throw new Error('createConversationContext: adapter must be an object');
  }
  const handler = new Proxy(adapter, {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `conversationContext.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  });
  return {
    summarize: (chatId) => handler.summarize(chatId),
    rememberTicket: (chatId, ticketId) => handler.rememberTicket(chatId, ticketId),
    rememberGame: (chatId, gameId) => handler.rememberGame(chatId, gameId),
    getDefaultMode: (chatId) => handler.getDefaultMode(chatId),
    setDefaultMode: (chatId, mode) => handler.setDefaultMode(chatId, mode),
    getRecentTickets: (chatId) => handler.getRecentTickets(chatId),
    getRecentGames: (chatId) => handler.getRecentGames(chatId),
    flushSync: () => handler.flushSync(),
  };
}

module.exports = { createConversationContext, REQUIRED_METHODS };
