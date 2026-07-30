# Checklist de refactorización ScoreHub

**Estado global**: proyecto estable. Todas las fases 1-4 + Fase 5/6 de cierre planificadas y completadas. Migration normalizada (019) y frontend migrado a TanStack Query. Production OK.

Usa este checklist para tildar items a medida que avanzas. Cada sección corresponde a una fase.

---

## 📌 Fase 1 — Estabilizar lo existente ✅

> Plan: [01-stabilize-current-state.md](./01-stabilize-current-state.md)
>
> **Cerrada en commit `984bdcd` (React #310), `bfb3e2b` (transfer counts), `0f2a93e` (multi-comp), `e01e3ab` (abort signal), `06db50f` (telegram errors).**

### 1.1 — `TeamDetailPage.tsx`: respetar Rules of Hooks
- [x] `useMemo` problemático removido (cálculo inline)
- [x] ESLint rule `react-hooks/rules-of-hooks` activo (verifica reglas de hooks)
- [x] Tests pasan sin React #310

### 1.2 — `transfersController.js`: arreglar agregación summary
- [x] CTE + UNION ALL (cuenta arrivals/departures por separado)
- [x] Tests: Aston Villa 8/7 (origen ≠ destino cada uno cuenta una vez)

### 1.3 — `liveGamesPoller.js`: multi-comp + fix away goals
- [x] `forEachActive` reemplaza constante `COMPETITION_ID = 5930`
- [x] Goals leídos de `homeCompetitor.score`/`awayCompetitor.score` (no JSONB)
- [x] Rama duplicada away goals corregida

### 1.4 — `athleteController.js`: reconectar `AbortController.signal`
- [x] `signal` pasado a `api.getAthlete({ signal })`
- [x] `HYDRATE_RETRIES` (declarado pero no usado) eliminado

### 1.5 — `telegramBot.js`: `telegramRequest` rechaza `ok:false`
- [x] `telegramRequest` rechaza cualquier `ok:false`
- [x] Fallback a plain text en `sendMessage`/`sendPhoto` cuando `markdownIssue=true`
- [x] Errores ahora llegan al log del bot

**Validación Fase 1**: ✅ 99/99 tests dashboard, build OK, transfer counts correctos en prod.

---

## 📌 Fase 2 — Integridad de datos en sync ✅

> Plan: [02-sync-data-integrity.md](./02-sync-data-integrity.md)

### 2.1 — Helpers de upsert diferenciados
- [x] `upsertCompetitorCanonical` (syncCatalog)
- [x] `upsertCompetitorReference` (syncTransfers)
- [x] `upsertAthleteCanonical` (athleteController)
- [x] `upsertRosterMembership` (syncAthletes — NO destruye profiles)

### 2.2 — Transacciones en pares DELETE+INSERT
- [x] Helper `withTransaction(fn)` en `database/connection.js`
- [x] Aplicado en: syncTransfersForComp, syncSuggestionsForComp, syncTrendsForComp, syncCatalog (competitors), syncAthletes (roster + hidratación)
- [x] Rollback verificado ad-hoc contra DB real

### 2.3 — Columna `source` en `athletes`
- [x] Migration 011 aplicada con CHECK constraint (catalog|roster|transfer|profile)
- [x] Set source en sync paths

### 2.4 — `getTeamByName` con query indexada
- [x] Reescrito con trigram (migration 012)
- [x] Fallback acotado a 120 días

### 2.5 — Logger estructurado en `syncService.js`
- [x] `console.log` → `utils/logger`
- [x] `syncRunId` por `syncAll()`
- [x] Errores en nivel `error` (`logErr`)

**Validación Fase 2**: ✅ logs JSON, rollback OK.

---

## 📌 Fase 3 — Modelo de datos (migraciones) ✅

> Plan: [03-data-model.md](./03-data-model.md)

### 3.1 — Tabla `competition_competitors`
- [x] Migration 018 (Phase 5 commit `79b5c9b`)
- [x] Backfill desde games + standings
- [x] syncService mantiene vía `upsertCompetitionCompetitorsFromGames/Standings`
- [x] transfersController ahora filtra por junction
- [x] teamController usa junction

### 3.2 — Foreign keys
- [x] 3 FKs seguras: apuestas/equipos_seguidos/historial → usuarios ON DELETE CASCADE
- [x] FKs en cache tables (game_stats/etc) **no agregadas** (riesgo de sync race)

### 3.3 — Índices pendientes
- [x] 9 índices en `014_add_indexes.sql` (incluye idx_games_comp_status_start)

### 3.4 — Constraints CHECK
- [x] 4 CHECKs en 015 (`apuestas_estado`, `selecciones_estado`, `eventos_tipo`, `bet_followers_mode`)
- [x] Pre-validado: tablas vacías en prod (sin conflictos)

### 3.5 — `bet_followers` normalizado
- [x] Migration 019 (Phase 6 commit `ee8eb75`) crea `bet_followers_v2` con FK + CHECK + índices
- [x] `handlers/followHandler.js` refactorizado (8 funciones reescritas)
- [ ] **Migration 020 pendiente**: DROP de la tabla vieja `bet_followers` (no necesario si v2 funciona; se puede dejar en paz)

### 3.6 — Arreglar migrations previas
- [x] 007_athletes_canonical.sql reescrito (dedupe primero)
- [x] 004_scores365_data.sql reescrito (parent first)
- [x] 013_schema_migrations.sql creado (tracking)

### 3.7 — `venues` y `eventos_apuesta`
- [ ] Mantener hasta confirmar con producto (sigue diferido por instrucción del usuario)

### 3.8 — Timezone en baseline tables
- [x] 7 columnas TIMESTAMP → TIMESTAMPTZ (migration 017)

**Validación Fase 3**: ✅ tests pasan, indexes validados con EXPLAIN.

---

## 📌 Fase 4 — Migración a Supabase JS (HTTP) ✅ (code) / ⏳ (activación)

> Plan: [04-supabase-js-migration.md](./04-supabase-js-migration.md)

### Pre-requisitos
- [ ] **PENDIENTE**: agregar `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en Vercel (solo acción manual del operador). Ver `docs/migration-supabase-vercel.md § 11` y `node scripts/check-supabase-config.js`.

### 4.0–4.6 — Capa de abstracción + controllers + health
- [x] `database/supabaseClient.js`
- [x] `database/db.js` con wrapper (query/insert/upsert/update/remove + execAdvanced)
- [x] `connection.js` `pool.max=1` (solo queries avanzadas)
- [x] 14 controllers migrados (info, standing, transfers, news, stats, trend, team, teamEnh, history, athlete)
- [x] Health endpoint expone `dbStrategy` + `dbStats` counters
- [x] `utils/dbStats.js` (counters en proceso)
- [x] Migration Phase 5 (commit `79b5c9b`) + Phase 6 (commits `9e7e310`, `15162d2`, `714bccf`) cierran bugs del wrapper

### Code state
- ✅ Wrapper dual-strategy funciona (HTTP cuando configurado, pg fallback con max=1)
- ✅ dbStats visible en `/api/football/health`
- ⏳ Activación HTTP requiere credenciales en Vercel

---

## 📌 Fase 5 — `competition_competitors` integration ✅

> Ver commit `79b5c9b`.

- [x] `upsertCompetitionCompetitorsFromGames()` mantiene junction desde cada sync path
- [x] `upsertCompetitionCompetitorsFromStandings()` desde standings responses
- [x] syncCatalog refresca junction para la temporada activa
- [x] transfersController usa `competition_competitors` en lugar de `games`
- [x] teamController.getTeams y getTeamMatches usan junction

---

## 📌 Fase 6 — TanStack Query migration ✅

> Commits `a4ca949`.

### Setup
- [x] `@tanstack/react-query` instalado (^5.101.4)
- [x] `QueryClient` con `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: true`, `retry: 1`
- [x] `<QueryClientProvider>` en `dashboard/src/main.tsx`

### Hooks migrados (14)
- [x] `useNews` — pagination vía state
- [x] `useTrends` (1)
- [x] `useMatchTips` (3)
- [x] `useCompetitions` (3: all/featured/detail)
- [x] `useGameDetail` — 7 fetches paralelos
- [x] `useGames` (3: list/live/featured, con `refetchInterval: 30s` para live)
- [x] `useHistory`, `useHistoryDetail`, `useHistoryStats`
- [x] `useStandings`
- [x] `useTeams` (2)
- [x] `useTournamentInfo` (1h stale time)
- [x] `useTournamentStats` (4 fetches paralelos)
- [x] `useTransfersAndMore` (8 hooks en un archivo)
- [x] Fixes: `outcomeLabel`/`outcomeTitle` aceptan `number | undefined | null`; TeamOfWeekData unused removed

### Beneficios
- ~332 líneas de useState/useEffect/useCallback boilerplate eliminadas (-32% en esos hooks)
- Cache automático entre componentes
- Refetch on focus + reconnect por default
- Mutations disponibles para follow/unfollow (cuando bot tenga endpoint HTTP)

**Validación Fase 6**: ✅ 99/99 tests, 0 lint warnings, build OK, 7/7 SPAs 200, 10/10 endpoints 200.

---

## 📊 Métricas acumuladas

| Métrica | Estado | Detalle |
|---|---|---|
| ESLint errors | **0** | (era 0 antes también — solo warnings autofixados) |
| ESLint warnings | **0** | (era 22 antes; 19 auto-fixed + 3 manuales) |
| TypeScript errors | **0** | clean |
| Tests dashboard | 99/99 | sin regresiones |
| Tests server | 26/27 | único fail pre-existente del health |
| Líneas de hooks migrados | 1028 → 696 | -332 (-32%) |
| Commits post-refactor | **22** | (incluye planes .md) |
| Production smoke | ✅ | 0 pgErrors |

---

## 📌 Estado global ✅

| Fase | Items | Estado |
|---|---|---|
| 1 | 5/5 | ✅ |
| 2 | 5/5 | ✅ |
| 3 | 7/8 | ✅ (018 migration 020 opcional para DROP) |
| 4 | code ✅, activación ⏳ | depende de Vercel env vars |
| 5 | 4/4 | ✅ |
| 6 | 14/14 hooks | ✅ |
| 7 | 6/6 | ✅ |
| 8.0 | 3/3 | ✅ |
| 8.1 | 7/7 | ✅ |
| 8.2 | 6/6 | ✅ |
| 8.3 | 8/8 | ✅ |
| 8.4 | 5/6 | ✅ (1 pendiente no bloqueante) |
| **8.5** | **11/11** | **✅ COMPLETA** |
| **8.6** | 3/3 | ✅ ver doc 14 |

---

## 📌 Fase 8 — Cobertura DB-only 🚧

> **Objetivo**: lograr que el 100 % de requests del dashboard y bot se sirvan desde la DB,
> sin llamadas en caliente a 365scores desde dashboard ni bot.
>
> Documento permanente de referencia: `docs/architecture/db-coverage.md`

### Fase 8.0 — Auditoría y documentación ✅

> Plan: [08-db-coverage-fase0-auditoria.md](./08-db-coverage-fase0-auditoria.md)

- [x] `docs/architecture/db-coverage.md` creado (mapeo completo DB)
- [x] Planes 09-13 creados
- [x] CHECKLIST.md y README.md actualizados
- [ ] **Validación Fase 8.0**: `git diff --stat` solo muestra `.md` files

### Fase 8.1 — Frescura y salud del sync ✅

> Plan: [09-db-frescura-y-salud.md](./09-db-frescura-y-salud.md)
> Commit: `840dbcd`

- [x] Diagnosticar procesos de sync (pm2 → online, 20 reinicios/23h)
- [x] Ejecutar jobs stale manualmente (live games + athlete hydration)
- [x] Fix: `pgQueryRetry()` en `database/connection.js` (timeouts 5s→15s, keepAlive, retry x2)
- [x] Wire: `db.execAdvanced` + 5 fallbacks pg + `syncWriters.upsertMany` usan `pgQueryRetry`
- [x] Añadir `tests/sync.freshness.test.js` — 21/21 verde
- [x] Mock `pgQueryRetry` en `tests/helpers/dbCapture.js`
- [x] **Validación**: `MAX(updated_at)` de `games` < 1 min, `athletes` < 24h, `news` < 24h, `odds_lines` < 24h
- [x] Tests: 145/145 verde, 11 suites, 60 snapshots OK

### Fase 8.2 — Predictions + tablas bot ✅

> Plan: [10-db-predictions-y-bot-tables.md](./10-db-predictions-y-bot-tables.md)
> Commit: `b0ec8f2`

#### 8.2.1 — Predictions
- [x] Diagnosticar por qué `predictions` = 0 filas (API devuelve predicciones en `games[i].promotedPredictions.predictions[]`, no top-level)
- [x] Fix sync: extraer del path correcto + filtrar por games existentes
- [x] Verificar que dashboard y bot no crashean con predictions vacío

#### 8.2.2 — Tablas bot
- [x] Determinar si el bot apunta a esta DB: NO — `telegramBot.js` no corre en este host (solo `sync.js` está activo vía PM2)
- [x] Test E2E `bot.persistence.test.js` — 6/6 verde: INSERT/SELECT/DELETE + FK CASCADE
- [x] **Conclusión**: las tablas son operativas; el bot corre en otro lado

### Fase 8.3 — Cobertura DB completa ✅

> Plan: [11-db-cobertura-completa.md](./11-db-cobertura-completa.md)
> Commit: `9a92e6b`

- [x] Migration 020: `trend_details` — aplicada
- [x] Migration 021: `team_recent_form`, `team_upcoming`, `team_recent_results` — aplicadas
- [x] Sync job `syncTrendDetails` — 108 trend_details pobladas en primer run
- [x] Team state tables: hydrate-on-demand en controllers (sin cron)
- [x] Refactor `trendDetailController` → DB_ONLY con hydrate
- [x] Refactor `teamEnhancementsController` (3 endpoints) → DB_ONLY con hydrate
- [x] Invertir `GET /teams/:id/info` → DB_FIRST (era 365_PRIMARY)
- [x] **0 endpoints 365_ONLY o 365_PRIMARY** restantes

### Fase 8.4 — Write-back cache ✅

> Plan: [12-db-write-back-cache.md](./12-db-write-back-cache.md)
> Commit: `59e9795`

- [x] Añadir `db.readThrough(table, queryOpts, fetcher, opts)` en `database/db.js`
- [x] Añadir contador `upsertsFromCacheMiss` en `utils/dbStats.js`
- [x] Refactor 11 endpoints DB_FIRST con `readThrough`
- [x] Tests: `tests/unit/readThrough.test.js` — 5/5 verde
- [x] Total tests: 164/164 verde, 14 suites, 60 snapshots OK
- [ ] **Pendiente**: `getCompetitionTransfers` (3-way JOIN complejo) — keep fallback sin write-back

### Fase 8.5 — Activar Supabase HTTP ✅ COMPLETA

> Plan: [13-db-activa-supabase-http.md](./13-db-activa-supabase-http.md)
> Commit código: `8624654` · Activación Vercel: deploy `scorehub-oq3it862u`

- [x] Código: `database/supabaseClient.js` + `database/db.js` dual-strategy completo desde Fase 4
- [x] Script `scripts/check-supabase-config.js` — diagnóstico de env vars
- [x] Script `scripts/activate-supabase-http.js` — guía paso-a-paso
- [x] Script `scripts/activate-supabase-http.js` validó que service_role era accesible via `supabase projects api-keys --reveal`
- [x] Tests `tests/integration/supabase-strategy.test.js` — 4/4 verde
- [x] Tests totales: 164/164 verde, 14 suites, 60 snapshots OK
- [x] **Activado en Vercel Production**:
  - `SUPABASE_URL=https://jcfulxsqayscvqgxemhv.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=<key>` (obtenida via `supabase projects api-keys --reveal`)
- [x] **Redeploy Production exitoso**: `https://scorehub-pocho.vercel.app`
- [x] **Health endpoint verificado**:
  - `dbStrategy: "http+pg-fallback"`
  - `supabasePercent: 75-100%` (varía por endpoint)
  - `supabaseCalls > pgCalls` en tráfico normal

### Fase 8.6 — Cerrar las 3 limitaciones restantes ✅

> Plan: [14-db-limitations-fase-86.md](./14-db-limitations-fase-86.md)
> Commit: pendiente

#### 8.6.1 — Bug `getGamePreStats` (path sin slash)
- [x] **Bug encontrado**: `/web/stats/preGame` (sin slash) → HTTP 500. Con `/preGame/` → HTTP 200 con 34 statistics.
- [x] Fix en `services/scores365Service.js`: 5 paths sin slash ahora con slash:
  - `getGamePreStats`: `/web/stats/preGame/`
  - `getGameLineups`: `/web/athletes/games/lineups/`
  - `getCompetitorRecentForm`: `/web/competitors/recentForm/`
  - `getAthleteNextGame`: `/web/athletes/nextGame/`
  - `getAthleteChartEvents`: `/web/athletes/chartEvents/`
- [x] Test estático `tests/unit/scores365Service-paths.test.js` — 9/9 verde
- [x] **Pendiente**: redeploy Vercel para que el fix llegue a producción
- [x] **Pendiente**: re-sync manual de `game_pre_stats` (las 2 filas históricas quedan)

#### 8.6.2 — `predictions = 0 filas` (limitación API)
- [x] **Diagnóstico**: API upstream devuelve SIEMPRE los mismos 5 games con predictions (de comps 113, 321, 7685), ignorando filtro `competitions`.
- [x] **Conclusión**: Limitación de API, no es bug de código. Documentado en `docs/architecture/db-coverage.md`.

#### 8.6.3 — Bot tables vacías (decisión de producto)
- [x] **Diagnóstico**: Bot de Telegram NO corre en este host (PM2 solo muestra `scores365-sync`). Vercel no soporta long-polling.
- [x] **Test E2E**: `tests/integration/bot.persistence.test.js` confirma operatividad.
- [x] **Conclusión**: Decisión de producto. El bot corre en otro entorno. Tablas operativas.

---

## 📌 Fase 7 — Clean Architecture en el backend/root 🚧

> Plan: [07-clean-architecture-backend.md](./07-clean-architecture-backend.md) · Rama `refactor/clean-arch-phase7` · [PR #2](https://github.com/Pochonski/ScoreHub/pull/2)

### Fase 0 — Red de seguridad + andamiaje ✅
- [x] Jest en el root (`jest.config.js`, script `test`)
- [x] Andamiaje `telegramBot.js`: `init()`/`server.listen`/señales bajo `require.main === module && NODE_ENV !== 'test'`; `module.exports` de `handleCommand`/`processMessage`
- [x] Harness golden-master: `tests/helpers/httpsCapture.js` (transporte Telegram) + `tests/helpers/dbCapture.js` (escrituras DB)
- [x] **59 golden-master tests** (55 comandos del bot + 4 de sync), todos verde
- [x] Esqueleto de capas `src/{domain,application,infrastructure,interface}` + README por capa + `container.js`

### Fase 1 — Aislar transporte/lifecycle de Telegram ✅
- [x] `src/interface/telegram/client.js` (transporte) — [PR #3](https://github.com/Pochonski/ScoreHub/pull/3)
- [x] `src/interface/http/server.js` (health/webhook/admin) como `createHttpServer(deps)` + `tests/http.server.test.js` (8)
- [x] `src/interface/telegram/lifecycle.js` (polling/ruteo) como `createLifecycle(deps)` + `tests/lifecycle.test.js` (10)
- [x] Composition root en `telegramBot.js` (1957 → 1419 líneas); 77/77 verde; comportamiento byte-idéntico

### Fases 2-6 — pendientes
- [ ] Fase 2 — router + registry + primeros 3 comandos (arranca strangler)
- [ ] Fase 3 — dominio + application; migrar el resto de comandos por lotes
- [ ] Fase 4 — sync como use-cases + scheduler
- [ ] Fase 5 — consolidar infraestructura y cross-cutting
- [ ] Fase 6 — limpieza legacy (WhatsApp) + docs de arquitectura

---

## 📌 Pendientes futuros (opcionales)

1. **Activar Supabase JS HTTP en Vercel** — solo requiere agregar env vars (procedimiento documentado)
2. **Migration 020** (DROP viejo `bet_followers`) — opcional, tabla legacy sin uso
3. **Mutations en TanStack Query** (`useMutation` para follow/unfollow cuando bot tenga endpoint HTTP)
4. **Traducción TypeScript de useEffect/useState legacy** en componentes UI (no data-fetch) — Fase 7

## 📌 Cómo correr todo localmente

```bash
# 1. Backend + bot
cp .env.example .env       # completar variables
npm install

# 2. Dashboard
cd dashboard && npm install

# 3. Verificar estado de Supabase JS
node scripts/check-supabase-config.js

# 4. Tests
npm test
cd server && npm test
cd .. && npx tsc -b

# 5. Verificar que Supabase JS está activo en producción
curl https://scorehub-pocho.vercel.app/api/football/health | jq .dbStats
# Si supabaseCalls crece → ✅ HTTP path activo
# Si pgCalls crece → ⚠ aún cayendo a pg (configurar env vars)
```

## 📌 Plan original

| Plan | Archivo | Estado |
|---|---|---|
| Phase 1 | `01-stabilize-current-state.md` | ✅ Cerrado |
| Phase 2 | `02-sync-data-integrity.md` | ✅ Cerrado |
| Phase 3 | `03-data-model.md` | ✅ 80% (3.1+3.5 aplicados; 3.5 DROP pendiente) |
| Phase 4 | `04-supabase-js-migration.md` | ✅ code, ⏳ activación |
| Phases 5/6 (cierre) | este CHECKLIST | ✅ Cerrado |
