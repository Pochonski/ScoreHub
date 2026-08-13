/**
 * src/domain/ports/scoresGateway.js — Puerto de datos de partidos (Fase 7, Fase 2, Fase 3).
 *
 * Contrato que consumen los use-cases de `application/matches`. La implementación
 * concreta vive en `infrastructure/scores365` (envuelve los handlers/servicios
 * 365scores existentes). El dominio define la forma; la infraestructura la cumple.
 *
 * Auditoría 2026-Q3 Fase 3.1: factory tipada con Proxy enforcement.
 * Cualquier adapter que no implemente los métodos requeridos falla ruidosamente
 * al primer acceso, no silenciosamente como antes (con `module.exports = {}`).
 *
 * @typedef {Object} ScoresGateway
 * @property {() => Promise<string>} getLiveGamesText  Texto formateado de partidos en vivo.
 * @property {() => Promise<Array>}  findLiveGames     Partidos en vivo (objetos, para teclados).
 * @property {() => Promise<string>} getFixtureText    Texto formateado del fixture.
 * @property {(competitionId:number) => Promise<{games?:Array}>} getFixtures  Fixtures crudos del upstream.
 * @property {number} competitionId  Id de la competición principal.
 */

const REQUIRED_METHODS = [
  'getLiveGamesText',
  'findLiveGames',
  'getFixtureText',
  'getFixtures',
  'getMatchDetailText',
  'findGame',
  'getGameTrendsText',
  'getGameOddsText',
  'getGameSuggestionsText',
  'getPredictionsText',
  'getH2HText',
  'getPreviaText',
  'getLineupsText',
  'getStatsVivoText',
  'getOutrightsText',
  'getTipPartidoText',
];

function createScoresGateway(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createScoresGateway: adapter must be an object');
  }
  // Crear proxy que valida que cada método requerido exista al acceder.
  // Esto evita errores silenciosos como `undefined is not a function` más adelante.
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      // No exigir para propiedades no-método del contrato (ej. competitionId getter).
      if (prop === 'competitionId') return target.competitionId;
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `scoresGateway.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createScoresGateway, REQUIRED_METHODS };