/**
 * src/domain/ports/IGeminiNluRepository.js — Puerto de NLU con Gemini (Fase 3).
 *
 * Abstrae el uso de Gemini para clasificación de intents. La intención es
 * eliminar la dependencia directa de `intentParser` (y futuros call-sites)
 * del módulo legacy `services/geminiService.js`, que sigue siendo la
 * implementación concreta.
 *
 * El prompt gigante (BOT_CONTEXT con INTENTS, ENTIDADES y REGLAS) vive
 * dentro del adapter — el dominio sólo necesita el shape del resultado.
 *
 * @typedef {Object} NluResult
 * @property {string} intent              // uno de INTENTOS.* o 'UNKNOWN'
 * @property {Object} entities            // { equipo, home, away, fecha, liga, grupo, ... }
 *
 * @typedef {Object} IGeminiNluRepository
 * @property {(text:string) => Promise<NluResult|null>} analyzeMessage
 * @property {(prompt:string) => Promise<string|null>} analyzeMessageRaw
 * @property {(intent:string, entities:Object) => Promise<string|null>} generateNaturalResponse
 */

const REQUIRED_METHODS = [
  'analyzeMessage',
  'analyzeMessageRaw',
  'generateNaturalResponse',
];

function createGeminiNluRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createGeminiNluRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `geminiNluRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createGeminiNluRepository, REQUIRED_METHODS };
