/**
 * src/application/scores365/scores365Adapter.js — Adapter de formatters 365scores (Fase 8).
 *
 * Wrapper tipado sobre el servicio de 365scores (`scores365Service.js` en este
 * directorio — ex `handlers/mundialista365Handler.js`).
 * Provee la interfaz que `scores365UseCases` espera:
 *   - 13 métodos públicos + `COMPETITION_ID` getter
 *   - Proxy enforcement: cualquier método faltante falla ruidosamente
 *
 * La migración completa (formatters inline en el use-case) queda como follow-up
 * — son ~700 líneas con lógica de presentación que necesita ser refactorizada
 * con cuidado para preservar el output byte-a-byte (Auditoría 2026-Q3 Fase 3).
 *
 * Por ahora este adapter es el boundary limpio: el use-case depende de la
 * interfaz, no del módulo legacy. Cuando los formatters se migren, este
 * archivo y `scores365Service.js` desaparecen.
 */

const scores365Service = require('./scores365Service');

const REQUIRED_METHODS = [
  'getTipPartido',
  'formatTipForGame',
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
];

function createScores365Adapter(legacyModule = scores365Service) {
  if (!legacyModule) {
    throw new Error('createScores365Adapter: legacyModule required');
  }

  // Verificar métodos requeridos al boot — falla rápido si el legacy
  // cambia y rompe el contrato.
  for (const method of REQUIRED_METHODS) {
    if (typeof legacyModule[method] !== 'function') {
      throw new Error(`scores365Adapter: legacyModule.${method} is not a function`);
    }
  }

  // Proxy enforcement (Auditoría 2026-Q3 Fase 3.1): cualquier método
  // faltante falla ruidosamente al primer acceso.
  return new Proxy(legacyModule, {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `scores365Adapter.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  });
}

module.exports = { createScores365Adapter, REQUIRED_METHODS };