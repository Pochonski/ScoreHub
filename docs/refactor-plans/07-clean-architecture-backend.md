# Fase 7 — Clean Architecture en el backend/root

> **Objetivo**: llevar el backend/root (bot de Telegram + servicio de sync + admin) a
> Clean Architecture formal, espejando la que ya tiene el frontend
> (`domain` / `application` / `infrastructure` / `interface`), **sin cambiar
> comportamiento** y de forma 100 % incremental y revertible.
>
> **Decisiones tomadas** (2026-07-27):
> - Profundidad: **Clean Architecture formal** (entities + use-cases + ports/adapters).
> - Lenguaje: **CommonJS/JS** por ahora. La migración a TypeScript es una fase futura aparte.
> - Estrategia de seguridad: **golden-master tests primero → strangler fig comando por comando**.
>
> **Estado**: **Fase 0 completa** ✅ (rama `refactor/clean-arch-phase7`, [PR #2](https://github.com/Pochonski/ScoreHub/pull/2)). Fases 1-6 pendientes.

## Progreso

| Fase | Estado | Detalle |
|---|---|---|
| 0 · Red de seguridad | ✅ | Jest en root, andamiaje en `telegramBot.js`, esqueleto de capas, **59 golden-master tests** (55 comandos del bot + 4 de sync), todos verde. |
| 1 · Transporte/lifecycle | ⏳ | siguiente |
| 2 · Router + comandos | ⏳ | |
| 3 · Migrar comandos | ⏳ | |
| 4 · Sync | ⏳ | |
| 5 · Infra/cross-cutting | ⏳ | |
| 6 · Legacy + docs | ⏳ | |

**Cobertura golden-master de Fase 0** (`npm test` en el root):
- `tests/telegramBot.commands.test.js` — texto/usage prompts
- `tests/telegramBot.dataCommands.test.js` — fixture/live/tips/trends/stats
- `tests/telegramBot.followCommands.test.js` — seguir/dejarseguir/info/grupo/resultado/analizar/racha/proximos
- `tests/telegramBot.historyCommands.test.js` — noticias/bracket/historial/goleadores/jugador/h2h/previa
- `tests/telegramBot.processMessage.test.js` — router de entrada (follow/conversational/fallback)
- `tests/sync.golden.test.js` — escrituras de standings/games/news
- Helpers: `tests/helpers/httpsCapture.js` (transporte Telegram), `tests/helpers/dbCapture.js` (escrituras DB)

---

## 1. Diagnóstico (estado actual)

El frontend (`dashboard/src/`) ya está en Clean Architecture. El backend/root **no**: la lógica
vive en dos monolitos y una capa de `handlers`/`services` que no respeta la regla de dependencia.

| Archivo | Líneas | Problema |
|---|---|---|
| `telegramBot.js` → `handleCommand` | ~1.100 (líneas 439–1535) | **God function**: un if-else de ~50 comandos; cada rama mezcla ruteo + lógica de negocio + formateo + llamadas HTTP a Telegram. |
| `telegramBot.js` (archivo completo) | 1.925 | Mezcla 6 responsabilidades: servidor HTTP admin, transporte Telegram, dispatch de comandos, persistencia (`saveHistory`), procesamiento de mensajes y el loop de polling/lifecycle. |
| `services/syncService.js` | 1.340 | 45+ funciones en un archivo; mezcla helpers de upsert, gateways a 365scores y orquestación de 20 jobs. Internamente modular (pares `syncXForComp`/`syncX`), pero sin capas. |
| `handlers/*` | — | Intentan ser adaptadores, pero `handleCommand` los puentea con lógica inline. |
| **root** | — | **Cero tests automatizados.** Todo el testing vive en `dashboard/`. Éste es el mayor riesgo del refactor. |

### Violaciones de la regla de dependencia
- Los comandos hablan directo con `scores365Service`, `pool`/`db`, `geminiService` e `images` — no hay puertos.
- El formateo (Markdown de Telegram) está incrustado en la lógica de negocio.
- No hay composition root ni inyección de dependencias → nada es testeable en aislamiento.

---

## 2. Arquitectura objetivo

Espejo del frontend, adaptado a un backend con múltiples "delivery mechanisms"
(Telegram, cron de sync, HTTP admin).

```
src/
├── domain/                  # Puro. Sin I/O, sin frameworks. No importa de ninguna otra capa.
│   ├── entities/            # Match, Team, Competition, Athlete, BetSlip, BetSelection, User, Standing
│   ├── value-objects/       # Market, Score, MatchStatus, CompetitionId
│   └── ports/               # INTERFACES (contratos): MatchRepository, ScoresGateway,
│                            #   NluGateway, OcrGateway, UserRepository, BetFollowerRepository, Notifier
│
├── application/             # Casos de uso. Orquesta el dominio. Depende SOLO de domain/ports.
│   ├── matches/             # GetLiveMatches, GetFixture, GetMatchPreview, GetH2H...
│   ├── teams/               # FollowTeam, UnfollowTeam, GetTeamNextMatches, ListFavorites...
│   ├── betting/             # ParseBetSlip, EvaluateBetSlip, TrackBetSlip...
│   ├── stats/ history/ ...  # un caso de uso por acción del usuario
│   └── sync/                # SyncLiveGames, SyncStandings, SyncAthletes... (los 20 jobs)
│
├── infrastructure/          # Adaptadores: implementan los ports de domain. Wrappea lo existente.
│   ├── scores365/           # Scores365Gateway  → envuelve services/scores365Service.js
│   ├── nlu/                 # GeminiNluAdapter   → envuelve services/geminiService.js
│   ├── ocr/                 # TesseractOcrAdapter→ envuelve services/ocrService.js
│   ├── persistence/         # SupabaseMatchRepository, PgUserRepository... → envuelven database/db.js
│   ├── config/ logging/ errors/   # utils/config, utils/logger, dbStats consolidados
│   └── container.js         # COMPOSITION ROOT: instancia adaptadores y los inyecta en use-cases
│
└── interface/               # Delivery. Traduce input externo → use-case → output formateado.
    ├── telegram/
    │   ├── client.js        # transporte: telegramRequest, sendMessage, sendPhoto, retry
    │   ├── lifecycle.js     # polling loop, webhook, fetchOnce, init, shutdown
    │   ├── router.js        # registry: mapa comando → command handler
    │   ├── commands/        # un archivo por comando; llama a un use-case y a un presenter
    │   └── presenters/      # formateo Markdown/teclados (lo que hoy está inline)
    ├── scheduler/           # el cron de sync.js: agenda use-cases de application/sync
    └── http/                # admin server (rate-limit + rutas admin)
```

### Regla de dependencia (la que hace que esto valga la pena)
```
interface ─▶ application ─▶ domain ◀─ infrastructure
                                 ▲
        infrastructure implementa los ports que domain define
```
- `domain` no importa de nadie.
- `application` importa **solo** `domain` (puertos + entidades).
- `infrastructure` e `interface` dependen hacia adentro; se enlazan en `container.js`.

### Mapa de migración (actual → objetivo)

| Hoy | Va a | Cómo |
|---|---|---|
| `handleCommand` (ramas) | `interface/telegram/commands/*` + `application/*` + `interface/telegram/presenters/*` | Una rama → un use-case + presenter, por vez (strangler). |
| `telegramRequest`, `sendMessage`, `sendPhoto`, `sendMediaGroup` | `interface/telegram/client.js` | Extracción mecánica. |
| `pollingLoop`, `fetchOnce`, `handleWebhookUpdate`, `init` | `interface/telegram/lifecycle.js` | Extracción mecánica. |
| `handleAdminRoute`, `checkRateLimit` | `interface/http/adminServer.js` | Extracción mecánica. |
| `services/scores365Service.js` | `infrastructure/scores365/` (impl de `ScoresGateway`) | Wrapper delgado — NO reescribir internals. |
| `services/geminiService.js` | `infrastructure/nlu/` (impl de `NluGateway`) | Wrapper delgado. |
| `services/ocrService.js` | `infrastructure/ocr/` (impl de `OcrGateway`) | Wrapper delgado. |
| `database/db.js` | `infrastructure/persistence/*` (impls de repositorios) | Repos que usan `db.js` por dentro. |
| `services/syncService.js` (45 fns) | `application/sync/*` + `infrastructure` gateways | Un dominio de sync por módulo. |
| `sync.js` (cron) | `interface/scheduler/` | Agenda use-cases. |
| `handlers/*` | Se disuelven en `application` + `interface/presenters` | A medida que migran comandos. |

---

## 3. Principios de seguridad (el "muy seguro")

Estos principios son **innegociables** y aplican a cada fase:

1. **Golden-master antes de tocar nada.** El root no tiene tests. La Fase 0 crea una red de
   *characterization tests*: se alimentan comandos representativos al bot con transporte y
   servicios mockeados, se captura el **payload exacto de salida** (texto + teclados) y se
   congela como snapshot. Todo refactor posterior debe mantener esos snapshots byte-idénticos.
   Lo mismo para los jobs de sync (snapshot de los upserts).

2. **Strangler fig, una pieza por vez.** No se reescribe el bot de una. Se introduce la nueva
   arquitectura **al lado** de la vieja, se rutea **un** comando por el nuevo camino, se verifica
   paridad contra el golden-master, y recién ahí se pasa al siguiente. `handleCommand` se
   encoge rama por rama hasta quedar vacío.

3. **Sin cambio de comportamiento por commit.** Cada commit es extracción mecánica pura,
   verificable de forma independiente y revertible. Si un paso cambia una sola tilde de un
   mensaje, se detiene y se investiga.

4. **Composition root explícito.** `container.js` es el único lugar que conoce las
   implementaciones concretas. Los tests inyectan fakes; producción inyecta adaptadores reales.

5. **Kill-switch de ruteo.** Mientras conviven viejo y nuevo dispatcher, un flag
   (`USE_NEW_ROUTER` / por-comando) permite revertir el ruteo al camino legacy **sin redeploy**.

6. **Una fase = un PR.** Tests + lint en verde en cada paso. Ninguna fase se mezcla con otra
   (misma regla que el refactor 01-06). Si una fase revela deuda nueva, se anota en el checklist
   sin expandir la fase en curso.

---

## 4. Fases

### Fase 0 — Red de seguridad y andamiaje · Riesgo: **Bajo** · Esfuerzo: 6–8 h · ✅ COMPLETA
**Nada se mueve todavía.** Sólo se crea con qué verificar.
- Configurar Jest en el root (`package.json` `test` script + config), reusando el patrón de `dashboard/server`.
- **Golden-master del bot**: tests que llaman a `handleCommand`/`processMessage` con `scores365`, `db`, `gemini`, `images` y el cliente Telegram mockeados; snapshot de cada `sendMessage`/`sendPhoto` para los ~15 comandos más usados (`/live`, `/fixture`, `/tabla`, `/tip`, `/odds`, `/previa`, `/h2h`, `/jugador`, `/goleadores`, `/seguir`, `/misfavoritos`, `/noticias`, `/historial`, `/bracket`, `/proximos`).
- **Golden-master de sync**: para los 6–8 jobs críticos (`syncLiveGames`, `syncStandings`, `syncGames`, `syncAthletes`, `syncTransfers`, `syncCatalog`), correr con gateway y db mockeados y snapshot de los upserts emitidos.
- Crear el esqueleto de carpetas `src/{domain,application,infrastructure,interface}` con un `README.md` por capa (describe la regla de dependencia). Sin código funcional.
- Crear `infrastructure/container.js` vacío (contrato de wiring).
- **Aceptación**: `npm test` (root) verde; el bot y el sync arrancan e imprimen idéntico a antes; `git diff` no toca `telegramBot.js`/`syncService.js` salvo `require` de test si hiciera falta exponer funciones (preferible exponer vía export condicionado a `NODE_ENV==='test'`).

### Fase 1 — Aislar transporte y lifecycle de Telegram · Riesgo: **Bajo** · Esfuerzo: 4–6 h
Extracción mecánica pura desde `telegramBot.js`:
- `interface/telegram/client.js` ← `telegramRequest`, `telegramRequestWithRetry`, `sendMessage`, `sendPhoto`, `sendMediaGroup`, `looksLikeMarkdownIssue`.
- `interface/telegram/lifecycle.js` ← `pollingLoop`, `fetchOnce`, `processUpdates`, `handleWebhookUpdate`, `init`, `sleep`.
- `interface/http/adminServer.js` ← `handleAdminRoute`, `checkRateLimit`.
- `telegramBot.js` queda como composition root delgado que importa y cablea estos módulos.
- **Aceptación**: golden-master de Fase 0 verde sin cambios; `telegramBot.js` baja de ~1.925 a unas ~1.200 líneas (casi todo lo que queda es `handleCommand`).

### Fase 2 — Router + registry + primeros 3 comandos (arranca strangler) · Riesgo: **Medio** · Esfuerzo: 6–8 h
- `interface/telegram/router.js`: registry `Map<comando, handler>` con soporte de alias y `@botmundialistabot`.
- Migrar **3 comandos simples y de bajo riesgo** (`/live`, `/fixture`, `/help`) fuera de `handleCommand`:
  - Definir el/los port necesarios (`ScoresGateway.getLiveGames`), su use-case (`application/matches/GetLiveMatches`), el adaptador (`infrastructure/scores365`) y el presenter.
  - Cablear en `container.js`.
- `handleCommand` primero consulta el router; si no hay match, cae al if-else legacy (kill-switch por comando).
- **Aceptación**: los 3 comandos migrados producen salida byte-idéntica (snapshot match); el resto intacto.

### Fase 3 — Dominio + application completos (migrar el resto de comandos) · Riesgo: **Medio** · Esfuerzo: 20–30 h
Por lotes, **un grupo por PR**, cada uno con su golden-master:
- **Lote A — Matches**: `/previa`, `/h2h`, `/proximos`, `/resultado`, `/tip`, `/tendencias`, `/predicciones`, `/stats-vivo`, `/odds`, `/outrights`.
- **Lote B — Teams/Follow**: `/seguir`, `/dejarseguir`, `/misfavoritos`, `/info`, `/grupo`, `/dondever`.
- **Lote C — Stats/History**: `/historial`, `/goleadores`, `/jugador`, `/bracket`, `/equipoideal`, `/noticias`, `/racha`, `/analizar`.
- **Lote D — Betting/OCR**: flujo de captura de cupón (hoy en `betImageHandler`/`bettingHandler`) → `application/betting/*` + `OcrGateway`.
- Extraer entities (`Match`, `Team`, `Competition`, `Athlete`, `BetSlip`, `User`, `Standing`) a medida que se necesitan.
- Envolver `scores365Service`, `geminiService`, `ocrService`, `db.js` como adaptadores (wrappers delgados; **no** reescribir su lógica interna).
- Al final: `handleCommand` queda vacío y se elimina; el `conversationalHandler` (NLU) se re-expresa como un use-case que mapea intent → use-case.
- **Aceptación**: 100 % de comandos por router → use-case → presenter; golden-master completo verde; `handleCommand` borrado.

### Fase 4 — Sync como use-cases + scheduler · Riesgo: **Medio** · Esfuerzo: 12–16 h
- Partir `syncService.js` en `application/sync/` por dominio: `games/`, `standings/`, `athletes/`, `transfers/`, `catalog/`, `news-trends/`, `odds/`, `details/`.
- Los helpers de upsert (`upsertCompetitorCanonical`, `withTransaction`, etc.) pasan a `infrastructure/persistence`.
- `interface/scheduler/` reemplaza a `sync.js`: agenda los use-cases con `jobGuard`.
- **Aceptación**: golden-master de sync (Fase 0) verde; los 20 jobs corren idéntico; `syncService.js` disuelto.

### Fase 5 — Consolidar infraestructura y cross-cutting · Riesgo: **Bajo** · Esfuerzo: 4–6 h
- Unificar config (`services/config.js` + acceso a `process.env`) en `infrastructure/config`.
- Logging, errores y `dbStats` a `infrastructure/`.
- `container.js` final; composition roots de bot / sync / admin todos lo usan.
- Retirar shims legacy de `handlers/` y `services/` cuando nadie los importe.
- **Aceptación**: sin imports colgados; `handlers/` y `services/` vacíos o eliminados; tests verdes.

### Fase 6 — Limpieza legacy y documentación · Riesgo: **Bajo** · Esfuerzo: 2–3 h
- Decidir con el usuario: **eliminar WhatsApp** (`bot.js`, path WhatsApp de `messageHandler`, dependencia `whatsapp-web.js` — dep pesada) o cuarentenarlo en `legacy/`. (No asumir; requiere OK de producto.)
- Nuevo `docs/architecture.md` con el diagrama de capas y la regla de dependencia.
- Actualizar sección "Arquitectura" del README (hoy describe el estado monolítico del root).
- **Aceptación**: README y docs reflejan la arquitectura real.

---

## 5. Orden, dependencias y esfuerzo

| Fase | Depende de | Riesgo | Esfuerzo |
|---|---|---|---|
| 0 · Red de seguridad | — | Bajo | 6–8 h |
| 1 · Transporte/lifecycle | 0 | Bajo | 4–6 h |
| 2 · Router + 3 comandos | 1 | Medio | 6–8 h |
| 3 · Migrar comandos | 2 | Medio | 20–30 h |
| 4 · Sync | 0 (paralelizable con 1–3) | Medio | 12–16 h |
| 5 · Infra/cross-cutting | 3, 4 | Bajo | 4–6 h |
| 6 · Legacy + docs | 5 | Bajo | 2–3 h |

**Total estimado: ~55–75 h.** Se puede pausar tras cualquier fase con el sistema en verde
(el bot funciona en cualquier punto porque el strangler mantiene el camino legacy hasta el final de Fase 3).

---

## 6. Métricas de éxito

| Métrica | Baseline | Objetivo |
|---|---|---|
| Función más larga | `handleCommand` ~1.100 líneas | < 60 líneas |
| Archivo más largo (root) | `telegramBot.js` 1.925 | < 200 por archivo |
| Tests en el root | 0 | golden-master de todos los comandos + jobs de sync |
| Regla de dependencia | violada en todos lados | `domain` sin imports salientes (verificable con dependency-cruiser) |
| Cobertura de use-cases | 0 % | use-cases testeados con fakes inyectados |
| Comportamiento observable | — | **idéntico** (snapshots byte-idénticos) |

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambio silencioso de un mensaje al extraer | Golden-master byte-a-byte; el snapshot rompe si cambia una tilde. |
| Bot en producción durante el refactor | Strangler + kill-switch de ruteo → revert instantáneo sin redeploy. |
| Regresión en sync (datos) | Golden-master de upserts; migrar sync en su propia fase aislada. |
| Scope creep hacia TS o "mejorar de paso" | Prohibido por principio 3 (sin cambio de comportamiento). TS es fase futura. |
| Adaptadores que reescriben lógica sin querer | Regla: los adaptadores son **wrappers delgados** de los `services` actuales. |

---

## 8. Qué NO hacer (guardrails de alcance)

- **No** migrar a TypeScript en esta fase (decidido: fase futura).
- **No** reescribir la lógica interna de `scores365Service`/`geminiService`/`ocrService` — sólo envolverlos.
- **No** tocar el frontend (ya está en Clean Architecture).
- **No** cambiar el esquema de DB ni las migraciones (eso fue Fase 3 del refactor previo).
- **No** mezclar fases: cada una se abre, se cierra y se valida antes de la siguiente.
- **No** "aprovechar" para cambiar textos, comandos o comportamiento del bot.

---

## 9. Primer paso concreto

Arrancar por **Fase 0**: montar Jest en el root y escribir el primer golden-master de 3–5
comandos. Sin esa red, ninguna extracción es segura. Ese es el gate para todo lo demás.
