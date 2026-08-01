/**
 * src/application/content/contentUseCases.js — Use-cases de contenido (Fase 7, Fase 3).
 *
 * noticias / equipo ideal / bracket / historial / goleadores. Goleadores combina
 * el ranking (contentGateway) con los outrights (scoresGateway), replicando el
 * comportamiento legacy (outrights best-effort: si falla, se omite).
 */

function createContentUseCases({ contentGateway, scoresGateway }) {
  return {
    noticias: (equipo) => contentGateway.getNoticias({ equipo, limit: 10 }),
    equipoIdeal: () => contentGateway.getEquipoIdeal(),
    bracket: (scope) => contentGateway.getBracket(scope),
    historial: (arg) => contentGateway.getHistorial(arg),
    goleadores: async () => {
      const scorers = await contentGateway.getGoleadores(10);
      const outrights = await scoresGateway.getOutrights().catch(() => null);
      return { scorers, outrights };
    },
  };
}

module.exports = { createContentUseCases };
