/**
 * src/application/matches/matchDetail.js — Use-cases de detalle (Fase 7, Fase 3).
 *
 * Conjunto cohesivo de acciones sobre un partido/competición: outrights, previa,
 * h2h, odds, stats en vivo y predicciones. Dependen solo del puerto ScoresGateway.
 */

function createMatchDetailUseCases({ scoresGateway }) {
  return {
    outrights: () => scoresGateway.getOutrights(),
    previa: (id) => scoresGateway.getPrevia(id),
    h2h: (id) => scoresGateway.getH2H(id),
    odds: (id) => scoresGateway.getOdds(id),
    statsVivo: (id) => scoresGateway.getStatsVivo(id),
    predicciones: (id) => scoresGateway.getPredicciones(id),
  };
}

module.exports = { createMatchDetailUseCases };
