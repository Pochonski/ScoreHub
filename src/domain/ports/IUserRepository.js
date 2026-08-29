/**
 * src/domain/ports/IUserRepository.js — Puerto de usuarios y equipos seguidos.
 *
 * Tablas: `usuarios` (registro de chatId → alias) y `equipos_seguidos`
 * (suscripciones a equipos por usuario). Las migraciones 003 y 019 introducen
 * `bet_followers` (v1 obsoleta, dropeada en 025; v2 con payload JSONB).
 *
 * @typedef {Object} UserDTO
 * @property {string} id                // chatId del usuario (string)
 * @property {string} alias
 * @property {string} [fechaRegistro]
 * @property {string} [estado]
 *
 * @typedef {Object} FollowedTeamDTO
 * @property {string} userId
 * @property {number} teamId
 * @property {string} teamName
 * @property {string} [fechaSeguimiento]
 *
 * @typedef {Object} IUserRepository
 * @property {(userId:string) => Promise<UserDTO|null>} findById
 * @property {(userId:string, alias:string) => Promise<UserDTO>} upsert
 * @property {(userId:string, teamId:number, teamName:string) => Promise<void>} addFollowedTeam
 * @property {(userId:string, teamId:number) => Promise<void>} removeFollowedTeam
 * @property {(userId:string) => Promise<FollowedTeamDTO[]>} listFollowedTeams
 */

const REQUIRED_METHODS = [
  'findById',
  'upsert',
  'addFollowedTeam',
  'removeFollowedTeam',
  'listFollowedTeams',
];

function createUserRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createUserRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `userRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createUserRepository, REQUIRED_METHODS };
