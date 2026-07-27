# `infrastructure/` — Adaptadores

Implementan los ports que define `domain/`. Wrappean lo que hoy vive en `services/` y `database/`
(**wrappers delgados** — no se reescribe la lógica interna de esos módulos en la Fase 7).

- `scores365/` — `Scores365Gateway` (impl de `ScoresGateway`) → envuelve `services/scores365Service.js`.
- `nlu/` — `GeminiNluAdapter` (impl de `NluGateway`) → envuelve `services/geminiService.js`.
- `ocr/` — `TesseractOcrAdapter` (impl de `OcrGateway`) → envuelve `services/ocrService.js`.
- `persistence/` — repositorios (`SupabaseMatchRepository`, `PgUserRepository`…) que usan `database/db.js` por dentro.
- `config/`, `logging/`, `errors/` — cross-cutting consolidado (env, `utils/logger`, `utils/dbStats`).
- `container.js` — **composition root**: instancia adaptadores y los inyecta en los casos de uso.
