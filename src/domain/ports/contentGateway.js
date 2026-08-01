/**
 * src/domain/ports/contentGateway.js — Puerto de contenido del Mundial (Fase 7, Fase 3).
 *
 * Noticias, equipo ideal, bracket, historial y goleadores. Implementado por
 * `infrastructure/content` (envuelve `mundialistaStatsHandler`).
 *
 * @typedef {Object} ContentGateway
 * @property {(opts:{equipo:?string, limit:number}) => Promise<string>} getNoticias
 * @property {() => Promise<string>} getEquipoIdeal
 * @property {(scope:string) => Promise<string>} getBracket
 * @property {(arg:?string) => Promise<string>} getHistorial
 * @property {(limit:number) => Promise<{photoUrl:?string, text:string}>} getGoleadores
 */

module.exports = {};
