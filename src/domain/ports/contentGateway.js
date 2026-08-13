/**
 * src/domain/ports/contentGateway.js — Puerto de contenido del Mundial (Fase 7, Fase 3).
 *
 * Noticias, equipo ideal, bracket, historial y goleadores. Implementado por
 * `infrastructure/content` (envuelve `mundialistaStatsHandler`).
 *
 * Auditoría 2026-Q3 Fase 3.2: factory tipada con Proxy enforcement (mismo patrón
 * que scoresGateway).
 *
 * @typedef {Object} ContentGateway
 * @property {(opts:{equipo:?string, limit:number}) => Promise<string>} getNoticias
 * @property {() => Promise<string>} getEquipoIdeal
 * @property {(scope:string) => Promise<string>} getBracket
 * @property {(arg:?string) => Promise<string>} getHistorial
 * @property {(limit:number) => Promise<{photoUrl:?string, text:string}>} getGoleadores
 */

const REQUIRED_METHODS = [
  'getNoticias',
  'getEquipoIdeal',
  'getBracket',
  'getHistorial',
  'getGoleadores',
];

function createContentGateway(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createContentGateway: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop) && typeof target[prop] !== 'function') {
        throw new Error(
          `contentGateway.${prop} is not implemented. ` +
          `Required methods: ${REQUIRED_METHODS.join(', ')}`
        );
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createContentGateway, REQUIRED_METHODS };