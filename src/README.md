# `src/` — Clean Architecture (backend/root)

Destino de la **Fase 7** ([plan](../docs/refactor-plans/07-clean-architecture-backend.md)).
El código del bot + sync migra acá de forma incremental (strangler fig). Mientras la
migración está en curso, conviven este árbol nuevo y los monolitos legacy
(`telegramBot.js`, `services/syncService.js`, `handlers/`).

## Regla de dependencia

```
interface ─▶ application ─▶ domain ◀─ infrastructure
                                 ▲
        infrastructure implementa los ports que domain define
```

- **`domain/`** — puro. Entities + value-objects + ports (interfaces). No importa de ninguna otra capa. Sin I/O, sin frameworks.
- **`application/`** — casos de uso. Orquesta el dominio. Importa **solo** `domain/`.
- **`infrastructure/`** — adaptadores que implementan los ports (scores365, gemini, ocr, repos de DB) + config/logging/errores. Wrappea lo que hoy vive en `services/` y `database/`.
- **`interface/`** — delivery: telegram (client/lifecycle/router/commands/presenters), scheduler de sync, http admin. Traduce input externo → use-case → output formateado.

El único lugar que conoce implementaciones concretas es `infrastructure/container.js` (composition root).
