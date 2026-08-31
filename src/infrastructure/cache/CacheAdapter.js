/**
 * src/infrastructure/cache/CacheAdapter.js — Adapter del ICache (Fase 8+).
 *
 * Wrapper del read-through cache (services/mundialCache.js) con Proxy
 * enforcement. La migración completa (state in-memory + TTL + debounced
 * save → 100% inline) queda como follow-up — son ~150 líneas con file I/O
 * que requieren refactor cuidadoso para preservar la semántica de
 * eviction + TTL.
 *
 * Por ahora el adapter es el boundary: el use-case depende del port,
 * no del módulo legacy. Tests pueden inyectar un stub in-memory.
 */

const { createCache, REQUIRED_METHODS } = require('../../domain/ports/ICache');
const legacy = require('../../../services/mundialCache');

/**
 * Factory: envuelve el legacy module con Proxy enforcement.
 * El parámetro legacyModule permite inyectar un mock en tests.
 */
function createCacheAdapter(legacyModule = legacy) {
  if (!legacyModule) {
    throw new Error('createCacheAdapter: legacyModule required');
  }

  // Validación boot-time: falla rápido si el legacy cambia y rompe el
  // contrato del port (Auditoría 2026-Q3 Fase 3.1).
  for (const method of REQUIRED_METHODS) {
    if (typeof legacyModule[method] !== 'function') {
      throw new Error(`createCacheAdapter: legacyModule.${method} is not a function`);
    }
  }

  return createCache(legacyModule);
}

module.exports = { createCacheAdapter };
