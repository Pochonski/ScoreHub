/**
 * src/domain/ports/ICompetitionRepository.js — Puerto de catálogo de competiciones.
 *
 * Tablas: `competitions` (catálogo, sync cada 6h) y `standings` (última tabla
 * de posiciones por stage). Las competiciones activas se filtran vía la tabla
 * `active_competitions` (migration 008) — ver `findActiveIds()`.
 *
 * @typedef {Object} CompetitionDTO
 * @property {number} id
 * @property {string} [name]      // join con catalogos si está disponible
 * @property {Object} data        // JSONB crudo de la API upstream
 * @property {string} [updatedAt]
 *
 * @typedef {Object} ICompetitionRepository
 * @property {(id:number) => Promise<CompetitionDTO|null>} findById
 * @property {() => Promise<CompetitionDTO[]>} findAll
 * @property {() => Promise<number[]>} findActiveIds
 */

const REQUIRED_METHODS = [
  'findById',
  'findAll',
  'findActiveIds',
];

function createCompetitionRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createCompetitionRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `competitionRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createCompetitionRepository, REQUIRED_METHODS };
