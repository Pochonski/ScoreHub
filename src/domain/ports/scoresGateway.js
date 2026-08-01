/**
 * src/domain/ports/scoresGateway.js — Puerto de datos de partidos (Fase 7, Fase 2).
 *
 * Contrato que consumen los use-cases de `application/matches`. La implementación
 * concreta vive en `infrastructure/scores365` (envuelve los handlers/servicios
 * 365scores existentes). El dominio define la forma; la infraestructura la cumple.
 *
 * @typedef {Object} ScoresGateway
 * @property {() => Promise<string>} getLiveGamesText  Texto formateado de partidos en vivo.
 * @property {() => Promise<Array>}  findLiveGames     Partidos en vivo (objetos, para teclados).
 * @property {() => Promise<string>} getFixtureText    Texto formateado del fixture.
 * @property {(competitionId:number) => Promise<{games?:Array}>} getFixtures  Fixtures crudos del upstream.
 * @property {number} competitionId  Id de la competición principal.
 */

module.exports = {};
