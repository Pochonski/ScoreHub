/**
 * src/infrastructure/scores365/scoresGateway.js — Adapter del puerto ScoresGateway
 * (Fase 7, Fase 2, Fase 8).
 *
 * Fase 8: el adapter ya no envuelve `mundialista365Handler` directamente.
 * Recibe los use-cases de `application/scores365/useCases.js` (que a su vez
 * envuelven al handler legacy como stepping stone). Cuando la Fase 3+ migre
 * las funciones internas, los use-cases dejarán de delegar y este gateway
 * no cambia.
 */

function createScoresGateway({ scores365UseCases, matchSearch, scores365 }) {
  if (!scores365UseCases) {
    throw new Error('createScoresGateway: scores365UseCases is required');
  }
  return {
    getLiveGamesText: () => scores365UseCases.getLiveGames(),
    findLiveGames: () => matchSearch.findLiveGames(),
    getFixtureText: () => scores365UseCases.getFixture(),
    getFixtures: (competitionId) => scores365.getFixtures(competitionId),
    get competitionId() {
      return scores365UseCases.getCompetitionId();
    },
    getOutrights: () => scores365UseCases.getOutrights(),
    getPrevia: (id) => scores365UseCases.getPrevia(id),
    getH2H: (id) => scores365UseCases.getH2H(id),
    getOdds: (id) => scores365UseCases.getOdds(id),
    getStatsVivo: (id) => scores365UseCases.getStatsVivo(id),
    getPredicciones: (id) => scores365UseCases.getPredicciones(id),
    getTipPartido: (home, away) => scores365UseCases.getTipPartido(home, away),
    getTendencias: (scope, id, limit) => scores365UseCases.getTendencias(scope, id, limit),
    getTendenciasByTeams: (home, away, limit) => scores365UseCases.getTendenciasByTeams(home, away, limit),
    findGameByTeams: (home, away) => matchSearch.findGameByTeams(home, away),
    getAlineacion: (id) => scores365UseCases.getAlineacion(id),
    formatTipForGame: (game) => scores365UseCases.formatTipForGame(game),
    getTendenciasForGame: (gameId) => scores365UseCases.getTendencias('game', gameId),
  };
}

module.exports = { createScoresGateway };
