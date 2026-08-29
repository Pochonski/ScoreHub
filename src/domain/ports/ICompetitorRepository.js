/**
 * src/domain/ports/ICompetitorRepository.js — Puerto de equipos/competidores.
 *
 * Tabla: `competitors` (catálogo de equipos por competición). El documento
 * JSONB en `data` lleva el nombre canónico, país, badge URL, etc. — los
 * use-cases deben evitar leer `data` salvo cuando sea estrictamente necesario
 * (preferir columnas indexadas para hot path).
 *
 * @typedef {Object} CompetitorDTO
 * @property {number} id
 * @property {number} [competitionId]
 * @property {string} [name]
 * @property {Object} data        // JSONB crudo (incluye countryId, badgeUrl, etc.)
 * @property {string} [updatedAt]
 *
 * @typedef {Object} ICompetitorRepository
 * @property {(id:number) => Promise<CompetitorDTO|null>} findById
 * @property {(competitionId:number) => Promise<CompetitorDTO[]>} findByCompetition
 */

const REQUIRED_METHODS = [
  'findById',
  'findByCompetition',
];

function createCompetitorRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createCompetitorRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `competitorRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createCompetitorRepository, REQUIRED_METHODS };
