/**
 * src/application/matches/trends.js — Use-cases de tips/tendencias (Fase 7, Fase 3).
 *
 * `findGame` es best-effort (si falla la resolución del partido, devuelve null),
 * replicando el `.catch(() => null)` del legacy.
 */

function createTrendsUseCases({ scoresGateway }) {
  return {
    tip: (home, away) => scoresGateway.getTipPartido(home, away),
    topTrends: () => scoresGateway.getTendencias('competition', null, 10),
    outrights: () => scoresGateway.getOutrights(),
    trendsByTeams: (home, away) => scoresGateway.getTendenciasByTeams(home, away, 10),
    findGame: (home, away) => scoresGateway.findGameByTeams(home, away).catch(() => null),
  };
}

module.exports = { createTrendsUseCases };
