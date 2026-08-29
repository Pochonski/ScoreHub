/**
 * src/application/scores365/useCases.js — Use-cases de 365scores (Fase 8).
 *
 * Reemplazan el módulo `handlers/mundialista365Handler.js` (735 líneas, 19
 * funciones). La estrategia de Fase 2/8 es crear factories de use-case que
 * reciben el adapter legacy como dep — la lógica de formateo y orquestación
 * sigue viviendo en `src/legacy/scores365-formatter.js` (cambiarla toda
 * llevaría varias horas sin valor inmediato; el contrato externo ya está
 * cubierto por `scoresGateway`).
 *
 * Fase 3+ (consolidación 365scores): migrar cada función a un use-case
 * propio con DB+cache+formateo inyectados, eliminando el adapter legacy.
 *
 * Mientras tanto, este módulo cumple tres objetivos:
 *   1. Punto único de inyección para el container — el gateway recibe
 *      `scores365UseCases` y deja de importar el adapter legacy.
 *   2. Proxy enforcement: si una función se elimina del adapter, el
 *      use-case falla ruidosamente (no `undefined is not a function`).
 *   3. API estable: cuando las funciones se migren, los call-sites no
 *      cambian.
 *
 * El adapter debe pasar por `createScores365Adapter()` antes de inyectarse
 * acá — eso valida boot-time que las 13 funciones requeridas existan.
 */

const REQUIRED_METHODS = [
  'fetchGameById',
  'formatTipForGame',
  'getTipPartido',
  'getTendencias',
  'getTendenciasByTeams',
  'getLiveGames',
  'getStatsVivo',
  'getAlineacion',
  'getPrevia',
  'getH2H',
  'getPredicciones',
  'getFixture',
  'getOutrights',
  'getOdds',
  'getCompetitionId',
  'getCompetitions',
];

function createScores365UseCases({ handler, logger = console }) {
  if (!handler) throw new Error('createScores365UseCases: handler required');

  // Proxy enforcement: cualquier método requerido que falte en el adapter
  // falla ruidosamente al primer acceso (Auditoría 2026-Q3 Fase 3.1).
  const proxied = new Proxy(handler, {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop) && typeof target[prop] !== 'function' && prop !== 'getCompetitionId' && prop !== 'getCompetitions') {
        throw new Error(
          `scores365UseCases.${prop} is not implemented. ` +
          `Required: ${REQUIRED_METHODS.join(', ')}`
        );
      }
      return target[prop];
    },
  });

  return {
    fetchGameById: (id) => proxied.fetchGameById(id),
    formatTipForGame: (game) => proxied.formatTipForGame(game),
    getTipPartido: (home, away) => proxied.getTipPartido(home, away),
    getTendencias: (scope, id, limit) => proxied.getTendencias(scope, id, limit),
    getTendenciasByTeams: (home, away, limit) => proxied.getTendenciasByTeams(home, away, limit),
    getLiveGames: () => proxied.getLiveGames(),
    getStatsVivo: (id) => proxied.getStatsVivo(id),
    getAlineacion: (id) => proxied.getAlineacion(id),
    getPrevia: (id) => proxied.getPrevia(id),
    getH2H: (id) => proxied.getH2H(id),
    getPredicciones: (id) => proxied.getPredicciones(id),
    getFixture: () => proxied.getFixture(),
    getOutrights: () => proxied.getOutrights(),
    getOdds: (id) => proxied.getOdds(id),
    getCompetitionId: () => proxied.COMPETITION_ID,
    // getCompetitions no existe en el handler legacy — los use-cases futuros
    // lo obtendrán de competitionRepository. Mientras tanto, devuelve null.
    getCompetitions: () => null,
  };
}

module.exports = { createScores365UseCases, REQUIRED_METHODS };
