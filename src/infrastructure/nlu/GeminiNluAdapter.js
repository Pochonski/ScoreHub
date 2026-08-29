/**
 * src/infrastructure/nlu/GeminiNluAdapter.js — Adapter del puerto IGeminiNluRepository.
 *
 * Wrapper delgado de `services/geminiService.js`. Fase 3 lo desacopla para
 * que `intentParser` no haga `require('./geminiService')` directo — ahora
 * recibe el adapter por DI vía container.
 *
 * Cuando se reemplace el backend (Claude, OpenAI, modelo local) el cambio
 * queda en este archivo; los call-sites no se enteran.
 */

class GeminiNluAdapter {
  constructor({ geminiService }) {
    if (!geminiService) {
      throw new Error('GeminiNluAdapter: geminiService required');
    }
    this._gemini = geminiService;
  }

  async analyzeMessage(text) {
    return this._gemini.analyzeMessage(text);
  }

  async analyzeMessageRaw(prompt) {
    return this._gemini.analyzeMessageRaw(prompt);
  }

  async generateNaturalResponse(intent, entities) {
    return this._gemini.generateNaturalResponse(intent, entities);
  }
}

module.exports = { GeminiNluAdapter };
