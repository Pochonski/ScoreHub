# Arquitectura del backend/root (Clean Architecture)

Resultado de la **Fase 7** ([plan](./refactor-plans/07-clean-architecture-backend.md)).
El bot de Telegram y el servicio de sync siguen Clean Architecture, espejando la
del frontend (`dashboard/src/`).

> Auditoría 2026-Q3: los ports ahora son factories tipadas con Proxy enforcement (Fase 3).
> Ver [`refactor-plans/audit-master-plan.md`](./refactor-plans/audit-master-plan.md).

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
│   └── ports/                 scoresGateway · contentGateway · messageHandlerGateway
├── application/
│   ├── matches/               getLiveMatches · getFixture · matchDetail · trends
│   ├── content/               contentUseCases (noticias, bracket, historial, goleadores…)
│   └── sync/                  agregador + 8 módulos por dominio (games, standings,
│                              content, trendsOdds, details, catalog, athletes,
│                              transfers) + context.js compartido
├── infrastructure/
│   ├── scores365/             scoresGateway  (envuelve services/scores365Service + mundialista365)
│   ├── content/               contentGateway (envuelve mundialistaStatsHandler)
│   ├── nlu/                   messageHandlerGateway (envuelve handlers/messageHandler)
│   ├── persistence/           syncWriters (upserts/junction del ETL)
│   ├── config.js              env vars del proceso bot
│   └── container.js           composition root: cablea todo y registra comandos
└── interface/
    ├── telegram/
    │   ├── client.js          transporte (telegramRequest, sendMessage, sendPhoto…)
    │   ├── lifecycle.js       long-polling + ruteo de updates + init
    │   ├── router.js          registry: comando → handler (exacto + prefijo con args)
    │   ├── callbacks.js       dispatcher de botones inline (tip/trends/odds…)
    │   ├── commands/          un módulo por familia (help, live, fixture, matchDetail,
    │   │                      trends, content, teams, profile, matchData, players)
    │   └── presenters/        keyboards · matchMessages · matchDetail · staticText
    ├── http/server.js         health / webhook / admin (factory con DI)
    └── scheduler/scheduler.js cron ETL (agenda los jobs de application/sync)
```

## Entry points (composition roots)

| Proceso | Entry | Cablea |
|---|---|---|
| Bot de Telegram | `telegramBot.js` (raíz, ~197 líneas) | `createContainer()` (router + callbacks) + `createLifecycle()` + `createHttpServer()` |
| Servicio de sync | `sync.js` → `interface/scheduler/scheduler.js` | los jobs de `application/sync` con `jobGuard` |
| Panel admin | `admin/server.js` | Express separado (app aparte) |

`telegramBot.js` quedó como composition root delgado: importa las capas, las
cablea e inicia el proceso solo como entry point (`require.main === module`).
`handleCommand` es hoy solo `router.dispatch()`.

## Flujo de un comando (ej. `/live`)

```
Telegram update → lifecycle.handleWebhookUpdate → processMessage → handleCommand
   → router.dispatch → commands/live → application/matches/getLiveMatches
       → domain/ports/scoresGateway ◀── infrastructure/scores365/scoresGateway
   → presenters/matchMessages → interface/telegram/client.sendMessage
```

## Cross-cutting compartido

`utils/logger`, `utils/dbStats`, `database/connection` (+ `withTransaction`),
`database/db` y `services/config` los usan **4 apps** (bot, sync, dashboard,
admin). Por eso viven en ubicaciones compartidas (`utils/`, `database/`), no
dentro del árbol `src/` del bot: moverlos acoplaría el dashboard.

Los adapters de `infrastructure/` son **wrappers delgados** de los `services/`
y `handlers/` existentes (no se reescribió su lógica interna en la Fase 7), por
lo que esos módulos siguen presentes y son envueltos, no eliminados.

## Red de seguridad (tests)

- **Golden-master** del bot (`tests/telegramBot.*.test.js`): congelan el output
  exacto (texto + teclados) de cada comando; garantizan cero cambio de
  comportamiento a lo largo del refactor.
- **Golden-master de sync** (`tests/sync.golden.test.js`): congela las
  escrituras de los 22 jobs ETL (SQL + params).
- Redes de `router`, `http.server`, `lifecycle`, `callbacks`.

`npm test` (root) corre todo; ver también `docs/refactor-plans/CHECKLIST.md`.
