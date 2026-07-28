/**
 * src/infrastructure/content/contentGateway.js — Adapter del puerto ContentGateway
 * (Fase 7, Fase 3). Wrapper delgado de `mundialistaStatsHandler`.
 */

function createContentGateway({ mundialistaStats }) {
  return {
    getNoticias: (opts) => mundialistaStats.getNoticias(opts),
    getEquipoIdeal: () => mundialistaStats.getEquipoIdeal(),
    getBracket: (scope) => mundialistaStats.getBracket(scope),
    getHistorial: (arg) => mundialistaStats.getHistorial(arg),
    getGoleadores: (limit) => mundialistaStats.getGoleadores(limit),
  };
}

module.exports = { createContentGateway };
