/**
 * src/domain/ports/IBetFollowerRepository.js — Puerto de seguidores de apuestas (Fase 8).
 *
 * Tabla: `bet_followers_v2` (migration 019). Una fila por
 * (apuesta_id, chat_id, mode) — los modos posibles son `all_events` y
 * `outcome_only` (cada usuario sigue un ticket en exactamente un modo).
 *
 * Reemplaza el legacy `bet_followers(ticket_id TEXT, chat_ids TEXT[])` que no
 * tenía FK (migration 003).
 *
 * @typedef {'all_events'|'outcome_only'} FollowMode
 *
 * @typedef {Object} BetFollowerDTO
 * @property {number} apuestaId
 * @property {string} chatId
 * @property {FollowMode} mode
 * @property {Object|null} [lastNotifiedStatus]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 *
 * @typedef {Object} BetTicketSummaryDTO
 * @property {number} id
 * @property {string} idUsuario
 * @property {number} [idPartidoApi]
 * @property {string} [estado]
 * @property {string} [partidoExtrado]
 *
 * @typedef {Object} IBetFollowerRepository
 * @property {(apuestaId:number) => Promise<BetTicketSummaryDTO|null>} getTicketSummary
 * @property {(apuestaId:number, chatId:string) => Promise<BetFollowerDTO|null>} getForUser
 * @property {(apuestaId:number, chatId:string, mode:FollowMode, lastNotified?:object|null) => Promise<void>} upsertForUser
 * @property {(apuestaId:number, chatId:string, mode:FollowMode) => Promise<void>} removeForUser
 * @property {(apuestaId:number, chatId:string) => Promise<void>} removeAllForUser
 * @property {(chatId:string, mode?:FollowMode) => Promise<number>} countByChat
 * @property {(chatId:string) => Promise<BetFollowerDTO[]>} listByChat
 * @property {(apuestaId:number, mode?:FollowMode) => Promise<BetFollowerDTO[]>} listByApuesta
 */

const REQUIRED_METHODS = [
  'getTicketSummary',
  'getForUser',
  'upsertForUser',
  'removeForUser',
  'removeAllForUser',
  'countByChat',
  'listByChat',
  'listByApuesta',
];

function createBetFollowerRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createBetFollowerRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `betFollowerRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createBetFollowerRepository, REQUIRED_METHODS };
