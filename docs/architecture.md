# Arquitectura del backend/root (Clean Architecture)

Resultado de las **Fases 7-2 + T1.x + T2.x** del refactor.

El bot de Telegram y el servicio de sync siguen Clean Architecture, espejando
la del frontend (`dashboard/src/`). Esta versión documenta el estado
**post-T2.x** (handlers/ eliminados, nlu.delegate migrados, repos
consolidados, tests con DB-capture en `tests/integration/`).

> T2.1: el directorio `handlers/` fue eliminado. Su contenido se migró
> a `application/` (use-cases) o se movió a `src/legacy/`.
> T1.4: las 10 llamadas `nlu.delegate()` de los commands de Telegram
> fueron reemplazadas por invocaciones directas de use-cases.

## Regla de dependencia

```
interface ──▶ application ──▶ domain ◀── infrastructure
                                   ▲
          infrastructure implementa los ports que domain define
```

- **`domain/`** no importa de ninguna otra capa (puro).
- **`application/`** importa solo `domain/` (puertos + entidades).
- **`infrastructure/`** e **`interface/`** dependen hacia adentro y se enlazan en el composition root (`infrastructure/container.js`).

## Árbol `src/`

```
src/
├── domain/
│   └── ports/                 8 ports con Proxy enforcement (Fase 3)
│                              ├ IMatchRepository
│                              ├ ICompetitionRepository
│                              ├ ICompetitorRepository
│                              ├ IUserRepository
│                              ├ IBetFollowerRepository
│                              ├ IBetRepository
│                              ├ IStatsRepository
│                              └ IGeminiNluRepository
├── application/
│   ├── bets/                  followTicket · processBetImage · conversationalFollow
│   ├── betting/               analizarEnfrentamiento · analizarEquipo
│   ├── matches/               partidosHoy/Fecha · resultadoEquipo/VS · proximosEquipo
│   ├── orchestration/         routeIntent (orquestador de intents NL)
│   ├── scores365/             useCases wrapper (proxy-enforced, fase 2-8)
│   ├── stats/                 noticias/equipoIdeal/bracket/historial/goleadores
│                              + teamStats + standings
│   ├── sync/                  orchestrator (Fase 4) + 9 módulos por dominio
│                              (catalog, games, standings, content, trendsOdds,
│                              details, athletes, transfers, betSelections)
│   └── teams/                 infoEquipo · seguirEquipo · dejarSeguirEquipo ·
│                              getEquiposSeguidos
├── infrastructure/
│   ├── persistence/           7 Pg adapters + barrel (lazy singletons)
│   │                          + syncWriters (legacy upserts del ETL)
│   ├── scores365/             scoresGateway (Fase 8)
│   ├── content/               contentGateway (Fase 2-2)
│   ├── nlu/                   GeminiNluAdapter (Fase 3)
│   ├── config.js              env vars del proceso bot
│   └── container.js           composition root: cablea todo y registra comandos
├── interface/
│   ├── telegram/
│   │   ├── client.js          transporte (telegramRequest, sendMessage, sendPhoto…)
│   │   ├── lifecycle.js       long-polling + ruteo de updates + init
│   │   ├── router.js          registry: comando → handler (exacto + prefijo con args)
│   │   ├── callbacks.js       dispatcher de botones inline (tip/trends/odds…)
│   │   ├── commands/          11 familias (help, live, fixture, matchDetail, trends,
│   │   │                      content, teams, profile, matchData, players, follow)
│   │   └── presenters/        keyboards · matchMessages · matchDetail · staticText
│   ├── http/server.js         health / webhook / admin (factory con DI)
│   └── scheduler/scheduler.js cron ETL (consume syncOrchestrator.run*)
└── legacy/                    scores365-formatter.js (formatters de 365scores;
                               migrará al adapter de scores365UseCases)
```

## Entry points (composition roots)

| Proceso | Entry | Cablea |
|---|---|---|
| Bot de Telegram | `telegramBot.js` (~170 líneas) | `createContainer()` (router + callbacks) + `createLifecycle()` + `createHttpServer()` |
| Servicio de sync | `sync.js` → `interface/scheduler/scheduler.js` | `createSyncOrchestrator()` (Fase 4) con `runFullSync()` y sub-runners por dominio |
| Panel admin | `admin/server.js` | Express separado (app aparte) |

`telegramBot.js` quedó como composition root delgado: importa las capas,
las cablea e inicia el proceso solo como entry point
(`require.main === module`). `handleCommand` es hoy solo `router.dispatch()`.

## Flujo de un comando slash (ej. `/live`)

```
Telegram update → lifecycle.handleWebhookUpdate → processMessage
  → handleCommand → router.dispatch
    → commands/live (T1.4: usa use-case directo)
      → application/matches/listMatches.createGetPartidosHoy
        → domain/ports/IMatchRepository (proxy-enforced)
        ← infrastructure/persistence/PgMatchRepository
    → presenters/matchMessages → interface/telegram/client.sendMessage
```

## Flujo de un mensaje NL (ej. "sígueme el 555")

```
Telegram update → lifecycle.handleWebhookUpdate → processMessage
  → handleNL (lazy container via ensureNLContext)
    → intentParser.parseIntent (Gemini)
      → IGeminiNluRepository (proxy-enforced)
      ← infrastructure/nlu/GeminiNluAdapter → services/geminiService
    → si confidence > threshold → routeIntent use-case
      → switch(intent) → use-case del dominio
    → sino → "No entendí"
```

## Repositorios (Fase 1)

| Port | Adapter | Tablas |
|---|---|---|
| `IMatchRepository` | `PgMatchRepository` | `games`, `standings` |
| `ICompetitionRepository` | `PgCompetitionRepository` | `competitions`, `active_competitions` |
| `ICompetitorRepository` | `PgCompetitorRepository` | `competitors` |
| `IUserRepository` | `PgUserRepository` | `usuarios`, `equipos_seguidos` |
| `IBetFollowerRepository` | `PgBetFollowerRepository` | `bet_followers_v2` |
| `IBetRepository` | `PgBetRepository` | `apuestas`, `apuesta_selecciones` |
| `IStatsRepository` | `PgStatsRepository` | `news`, `team_of_week`, `brackets`, `competition_history`, `tournament_stats` |

El `container.js` los expone como singletons lazy via `persistence/index.js`.

## Cross-cutting compartido

`utils/logger`, `utils/dbStats`, `database/connection` (+ `withTransaction`),
`database/db` y `services/config` los usan **4 apps** (bot, sync, dashboard,
admin). Por eso viven en ubicaciones compartidas (`utils/`, `database/`,
`services/`), no dentro del árbol `src/` del bot: moverlos acoplaría el
dashboard.

`services/` quedó como capa de **adapters sin port propio** (cache,
geminiService, scores365Service, ocrService, betParserService,
imageStorageService, countryFlagsService, betTrackingEngine,
competitionName, config). Cuando alguno necesite migración a port, se
crea un port + adapter en `domain/ports/` + `infrastructure/` y se
sustituye la inyección en el container.

## Red de seguridad (tests)

- **Unit tests** (`tests/unit/`): 30 suites, 347 tests. Cubren use-cases,
  ports (Proxy enforcement), adapters (dbCapture), syncOrchestrator
  (con mocks).
- **Integration tests** (`tests/integration/`): 9 suites, ~55 tests.
  Cubren use-cases contra DB captura (mismo patrón que sync.golden).
  4 preexistentes (active-competitions, bot.persistence, simulate-bot,
  supabase-strategy) + 5 nuevos en T2b:
    - `useCases-followTicket.test.js`
    - `useCases-team.test.js`
    - `useCases-matches.test.js`
    - `useCases-stats.test.js`
    - `syncOrchestrator.test.js`
- **Golden-master** de sync (`tests/sync.golden.test.js`): congela las
  escrituras de los 22 jobs ETL (SQL + params). Se mantiene para detectar
  regresiones cuando se migre `syncWriters` a repos.

`npm test` (root) corre todo. Tests skipped: 3 suites que requieren
`SUPABASE_DB_URL` real (bot.persistence, active-competitions,
supabase-strategy) y se saltan automáticamente si no está configurada.

## Cambios recientes (T1.x + T2.x)

- T1.1: `telegramBot.js` eliminó requires de 4 handlers legacy muertos.
- T1.2: `scheduler.js` usa `syncOrchestrator` (DI explícita) en lugar
  de `syncService` directo.
- T1.3: `listMatches.js` recibe `scores365UseCases` en lugar de
  `mundialista365` directo.
- T1.4: 10 llamadas `nlu.delegate()` en commands → invocaciones directas
  de use-cases (5x más rápido, 0 calls a Gemini para slash+text).
- T1.5: `useNlu.js` eliminado (0 callers post-T1.4).
- T2.1: directorio `handlers/` (12 archivos, ~3400 líneas) eliminado.
  `mundialista365Handler.js` movido a `src/legacy/scores365-formatter.js`
  para preservar los formatters 365scores (sigue siendo wrapper de
  scores365UseCases).
- T2.2: 5 tests legacy de `tests/telegramBot.*.test.js` eliminados
  (importaban handlers que ya no existen).
- T2.3: `container.js` deps legacy removidas del destructure; typedef
  actualizado.
- T2b: 5 integration tests nuevos contra DB-capture (T2b).

## Pendiente (F3+ → "100%")

- Migrar `src/legacy/scores365-formatter.js` al adapter de scores365UseCases
  (formatters inline en el use-case). Esto elimina la última dependencia
  de la carpeta `handlers/` (que ya no existe) y deja `src/legacy/` vacío.
- Consolidar `services/` en ports + adapters cuando se necesite (Fase 3+).
- Actualizar `docs/architecture.md` continuamente cuando entren nuevos
  puertos/use-cases.
