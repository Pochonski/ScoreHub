/**
 * src/infrastructure/conversation/ConversationContextAdapter.js — Adapter del IConversationContext.
 *
 * Re-exporta el módulo legacy `services/conversationContext.js` con
 * Proxy enforcement del puerto. La migración completa (state in-memory +
 * persistencia file-backed con debounce → 100% inline en el adapter sin
 * pasar por el require legacy) queda como follow-up — son ~150 líneas
 * de file I/O que requieren refactor cuidadoso para preservar la
 * semántica de TTL + save-on-dirty.
 *
 * Por ahora el adapter es el boundary: el use-case depende de la interfaz,
 * no del módulo legacy. Tests pueden inyectar un stub in-memory.
 */

const { createConversationContext, REQUIRED_METHODS } = require('../../domain/ports/IConversationContext');
const legacy = require('../../../services/conversationContext');

/**
 * Factory: envuelve el legacy module con Proxy enforcement.
 * El parámetro legacyModule permite inyectar un mock en tests.
 */
function createConversationContextAdapter(legacyModule = legacy) {
  if (!legacyModule) {
    throw new Error('createConversationContextAdapter: legacyModule required');
  }

  // Validación boot-time: falla rápido si el legacy cambia y rompe
  // el contrato del port (Auditoría 2026-Q3 Fase 3.1).
  for (const method of REQUIRED_METHODS) {
    if (typeof legacyModule[method] !== 'function') {
      throw new Error(`createConversationContextAdapter: legacyModule.${method} is not a function`);
    }
  }

  return createConversationContext(legacyModule);
}

module.exports = { createConversationContextAdapter };
