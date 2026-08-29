/**
 * src/domain/ports/IMatchRepository.js — Puerto de repositorio de partidos (Fase 7, Fase 8).
 *
 * Contrato que consumen los use-cases de `application/matches` y los
 * presenters de `interface/telegram/presenters`. La implementación concreta
 * vive en `infrastructure/persistence/` (PgMatchRepository hoy; podría haber
 * InMemoryMatchRepository para tests). El dominio define la forma; la
 * infraestructura la cumple.
 *
 * Misma fábrica con Proxy enforcement que `createScoresGateway` (Auditoría
 * 2026-Q3 Fase 3.1): cualquier adapter que no implemente los métodos
 * requeridos falla ruidosamente al primer acceso, no silenciosamente.
 *
 * Los métodos devuelven DTOs del dominio (camelCase, sin `pg` types ni
 * columnas crudas), no filas de la DB. La forma del DTO está documentada en
 * cada typedef abajo.
 *
 * @typedef {Object} MatchCompetitor
 * @property {number} id
 * @property {string} [name]     // cuando se hace JOIN con competitors.name
 * @property {number} [score]
 *
 * @typedef {Object} MatchDTO
 * @property {number} id
 * @property {number} competitionId
 * @property {number} [statusGroup]
 * @property {string} [statusText]
 * @property {string} [startTime]  // ISO 8601 string
 * @property {MatchCompetitor} homeCompetitor
 * @property {MatchCompetitor} awayCompetitor
 * @property {number} [stage]
 * @property {number} [seasonNum]
 * @property {Object} [data]       // payload crudo de la API upstream (JSONB)
 *
 * @typedef {Object} StandingDTO
 * @property {number} competitionId
 * @property {number} stageNum
 * @property {Object} data         // JSONB con la tabla de posiciones
 * @property {string} [updatedAt]
 *
 * @typedef {Object} IMatchRepository
 * @property {(id:number) => Promise<MatchDTO|null>} findById
 * @property {(competitionId:number, dateStr:string) => Promise<MatchDTO[]>} findByCompetitionAndDate
 * @property {(competitionId:number, opts?:{limit?:number}) => Promise<MatchDTO[]>} findRecentByCompetition
 * @property {(competitionId:number) => Promise<StandingDTO|null>} findLatestStanding
 */

const REQUIRED_METHODS = [
  'findById',
  'findByCompetitionAndDate',
  'findRecentByCompetition',
  'findLatestStanding',
];

function createMatchRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createMatchRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `matchRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createMatchRepository, REQUIRED_METHODS };
