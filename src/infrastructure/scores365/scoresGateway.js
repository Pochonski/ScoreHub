/**
 * src/infrastructure/scores365/scoresGateway.js — Adapter del puerto ScoresGateway
 * (Fase 7, Fase 2).
 *
 * Wrapper DELGADO sobre los colaboradores 365scores existentes
 * (`mundialista365Handler`, `matchSearch`, `scores365Service`). No reescribe su
 * lógica interna — solo los expone bajo la forma del puerto `domain/ports/scoresGateway`.
 */

function createScoresGateway({ mundialista365, matchSearch, scores365 }) {
  return {
    getLiveGamesText: () => mundialista365.getLiveGames(),
    findLiveGames: () => matchSearch.findLiveGames(),
    getFixtureText: () => mundialista365.getFixture(),
    getFixtures: (competitionId) => scores365.getFixtures(competitionId),
    get competitionId() {
      return mundialista365.COMPETITION_ID;
    },
    // Detalle de partido / competición (Fase 3).
    getOutrights: () => mundialista365.getOutrights(),
    getPrevia: (id) => mundialista365.getPrevia(id),
    getH2H: (id) => mundialista365.getH2H(id),
    getOdds: (id) => mundialista365.getOdds(id),
    getStatsVivo: (id) => mundialista365.getStatsVivo(id),
    getPredicciones: (id) => mundialista365.getPredicciones(id),
    // Tips y tendencias (Fase 3 batch A2).
    getTipPartido: (home, away) => mundialista365.getTipPartido(home, away),
    getTendencias: (scope, id, limit) => mundialista365.getTendencias(scope, id, limit),
    getTendenciasByTeams: (home, away, limit) => mundialista365.getTendenciasByTeams(home, away, limit),
    findGameByTeams: (home, away) => matchSearch.findGameByTeams(home, away),
  };
}

module.exports = { createScoresGateway };
