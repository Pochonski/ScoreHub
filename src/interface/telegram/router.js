/**
 * src/interface/telegram/router.js — Registry de comandos (Fase 7, Fase 2).
 *
 * Reemplaza incrementalmente al God function `handleCommand` (strangler fig):
 * cada comando migrado se registra acá con sus triggers (aliases + variante
 * `@botmundialistabot`); `handleCommand` consulta el router primero y solo cae
 * al if-else legacy para comandos aún no migrados.
 *
 * Soporta dos formas de matching:
 *   - EXACTO (`register`): comando sin argumentos (`/live`, `/bracket grupos`).
 *   - PREFIJO (`registerPrefix`): comando con argumentos (`/previa <id>`). El
 *     handler recibe `ctx.arg` = el texto (case original) después del comando.
 */

function normalize(cmd) {
  return String(cmd).trim().toLowerCase().replace(/@botmundialistabot\b/g, '');
}

// Extrae el argumento: todo lo que sigue al primer token (el comando, incl.
// @suffix), en el case original.
function extractArg(text) {
  return String(text).trim().replace(/^\S+\s+/, '').trim();
}

function createRouter() {
  const exact = new Map();  // comando normalizado → handler
  const prefix = new Map(); // palabra-comando normalizada → handler (con args)

  /**
   * @param {string[]} triggers  comandos/aliases que disparan el handler
   * @param {(ctx) => Promise<void>} handler
   */
  function register(triggers, handler) {
    for (const t of triggers) {
      const key = normalize(t);
      if (exact.has(key)) {
        throw new Error(`Router: trigger exacto duplicado "${key}"`);
      }
      exact.set(key, handler);
    }
  }

  /**
   * Registra un comando con argumentos. El handler recibe `ctx.arg`.
   * @param {string[]} triggers  palabras-comando (sin el argumento)
   * @param {(ctx) => Promise<void>} handler
   */
  function registerPrefix(triggers, handler) {
    for (const t of triggers) {
      const key = normalize(t);
      if (prefix.has(key)) {
        throw new Error(`Router: trigger prefijo duplicado "${key}"`);
      }
      prefix.set(key, handler);
    }
  }

  function has(cmd) {
    const norm = normalize(cmd);
    return exact.has(norm) || prefix.has(norm.split(' ')[0]);
  }

  /**
   * Despacha un comando. Devuelve true si un handler lo atendió, false si no
   * (para que el caller caiga al camino legacy).
   * @param {{ cmd: string, text: string }} ctx
   */
  async function dispatch(ctx) {
    const norm = normalize(ctx.cmd);

    // 1. Match exacto (comando sin args).
    const exactH = exact.get(norm);
    if (exactH) {
      await exactH(ctx);
      return true;
    }

    // 2. Match por prefijo (comando + args). Solo si hay algo después del comando.
    const word = norm.split(' ')[0];
    const prefixH = prefix.get(word);
    if (prefixH && norm.length > word.length) {
      await prefixH({ ...ctx, arg: extractArg(ctx.text) });
      return true;
    }

    return false;
  }

  return { register, registerPrefix, has, dispatch };
}

module.exports = { createRouter, normalize };
