/**
 * src/interface/telegram/router.js — Registry de comandos (Fase 7, Fase 2).
 *
 * Reemplaza incrementalmente al God function `handleCommand` (strangler fig):
 * cada comando migrado se registra acá con sus triggers (aliases + variante
 * `@botmundialistabot`); `handleCommand` consulta el router primero y solo cae
 * al if-else legacy para comandos aún no migrados.
 *
 * De momento matchea comandos EXACTOS (sin argumentos). El matching por prefijo
 * (comandos con args) se agrega cuando se migren esos comandos (Fase 3).
 */

function normalize(cmd) {
  return String(cmd).trim().toLowerCase().replace(/@botmundialistabot\b/g, '');
}

function createRouter() {
  const exact = new Map(); // comando normalizado → handler

  /**
   * @param {string[]} triggers  comandos/aliases que disparan el handler
   * @param {(ctx) => Promise<void>} handler
   */
  function register(triggers, handler) {
    for (const t of triggers) {
      const key = normalize(t);
      if (exact.has(key)) {
        throw new Error(`Router: trigger duplicado "${key}"`);
      }
      exact.set(key, handler);
    }
  }

  function has(cmd) {
    return exact.has(normalize(cmd));
  }

  /**
   * Despacha un comando. Devuelve true si un handler lo atendió, false si no
   * (para que el caller caiga al camino legacy).
   * @param {{ cmd: string }} ctx
   */
  async function dispatch(ctx) {
    const handler = exact.get(normalize(ctx.cmd));
    if (!handler) return false;
    await handler(ctx);
    return true;
  }

  return { register, has, dispatch };
}

module.exports = { createRouter, normalize };
