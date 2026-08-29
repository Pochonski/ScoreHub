/**
 * src/infrastructure/content/contentGateway.js — Adapter del puerto ContentGateway
 * (Fase 7, Fase 3, Fase 8).
 *
 * Fase 8: el adapter ya no envuelve `mundialistaStatsHandler` (legacy). En
 * su lugar recibe los use-cases de `application/stats/` ya construidos por
 * el container, lo que desacopla el gateway de los handlers en `handlers/`
 * y de los `require` directos a pg/db.js.
 *
 * El shape externo (5 métodos) no cambia; los use-cases de Telegram (en
 * `interface/telegram/commands/content.js`) siguen llamando
 * `content.noticias / equipoIdeal / bracket / historial / goleadores` sin
 * enterarse del cambio.
 */

function createContentGateway({ statsUseCases }) {
  if (!statsUseCases) {
    throw new Error('createContentGateway: statsUseCases is required');
  }
  return {
    getNoticias: (opts) => statsUseCases.noticias(opts),
    getEquipoIdeal: () => statsUseCases.equipoIdeal(),
    getBracket: (scope) => statsUseCases.bracket(scope),
    getHistorial: (arg) => statsUseCases.historial(arg),
    getGoleadores: (limit) => statsUseCases.goleadores(limit),
  };
}

module.exports = { createContentGateway };
