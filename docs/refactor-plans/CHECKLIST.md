# Checklist de refactorización ScoreHub

Usa este checklist para tildar items a medida que avanzas. Cada sección corresponde a una fase. Marcar con `[x]` cuando completado y añadir comentario si encuentras desviación del plan.

---

## 📌 Fase 1 — Estabilizar lo existente

> Plan: [01-stabilize-current-state.md](./01-stabilize-current-state.md)

### 1.1 — `TeamDetailPage.tsx`: respetar Rules of Hooks
- [x] Identificar el `useMemo(formStats)` problemático (líneas 73-85)
- [x] Eliminar el hook (calcular inline como variable)
- [x] Probar navegación a `/equipo/:id` sin error #310
- [x] Commit (`984bdcd`)

### 1.2 — `transfersController.js`: corregir agregación summary
- [x] Reescribir SQL con CTE + UNION ALL
- [x] Mantener el filtro por `games` (intacto del fix anterior)
- [x] Test: origen ≠ destino suma correcto
- [x] Commit (`bfb3e2b`)

### 1.3 — `liveGamesPoller.js`: multi-comp + fix away goals
- [x] Investigar payload de `getGameStats` para separar home/away goals (goles vienen en `homeCompetitor.score` / `awayCompetitor.score`)
- [x] Reemplazar `COMPETITION_ID = 5930` por iteración con `forEachActive`
- [x] Corregir rama duplicada de away goals
- [x] Eliminar `getCompetitorScore` si es código muerto (queda como deprecated helper)
- [x] Commit (`0f2a93e`)

### 1.4 — `athleteController.js`: reconectar `AbortController.signal`
- [x] Pasar `signal` a `api.getAthlete()` (vía opción `opts.signal` en `scores365Service.get`)
- [x] Eliminar `HYDRATE_RETRIES` (declarado pero no usado)
- [x] Verificar firma real de `getAthlete` (ahora acepta `opts`)
- [x] Test actualizado
- [x] Commit (`e01e3ab`)

### 1.5 — `telegramBot.js`: `telegramRequest` rechaza `ok:false`
- [x] Modificar `telegramRequest` para rechazar cualquier `ok:false` con `Error` anotado
- [x] Añadir fallback a plain text en `sendMessage`/`sendPhoto` cuando `markdownIssue=true`
- [x] Commit (`06db50f`)

### Validación Fase 1
- [x] Build pasa
- [x] Tests pasan (99/99 dashboard, 26/27 server con único test pre-existente del health)
- [x] Lint pasa (0 errores)
- [x] Deploy a Vercel OK
- [x] Health endpoint reporta OK
- [x] `/api/football/competitions/7/transfers/summary` devuelve números correctos en prod (Aston Villa 8/7, antes 7/7)

---

## 📌 Fase 2 — Integridad de datos en sync

> Plan: [02-sync-data-integrity.md](./02-sync-data-integrity.md)

### 2.1 — Helpers de upsert diferenciados
- [x] Crear `upsertCompetitorCanonical()` en `syncService.js`
- [x] Crear `upsertCompetitorReference()`
- [x] Crear `upsertAthleteCanonical()`
- [x] Crear `upsertRosterMembership()`
- [x] Aplicar en sync paths relevantes
- [x] Documentar criterio "canónico"
- [x] Commit (`8f51dcc`)

### 2.2 — Transacciones en pares DELETE+INSERT
- [x] Crear helper `withTransaction(fn)` en `connection.js`
- [x] Envolver `syncTransfersForComp`
- [x] Envolver `syncSuggestionsForComp`
- [x] Envolver `syncTrendsForComp`
- [x] Envolver `syncCatalog` (competitors)
- [x] Envolver `syncAthletes` (roster + hidratación individual)
- [x] Test ad-hoc de rollback (count antes/después de throw)
- [x] Commit (`4ac76ef`)

### 2.3 — Columna `source` en `athletes`
- [x] Migration `011_athletes_source.sql` aplicada
- [x] Enum check constraint
- [x] Set source correctamente en cada sync path
- [x] Verificar que roster sync no destruye profiles
- [x] Commit (parte de `254bddd`)

### 2.4 — `getTeamByName` con query indexada
- [x] Reescribir `mundialCache.js#getTeamByName` con trigram
- [x] Migration `012_competitors_name_trgm.sql`
- [x] Fallback acotado a 120 días
- [x] Commit (`05989c4`)

### 2.5 — Logger estructurado en `syncService.js`
- [x] Reemplazar `console.log` por `utils/logger`
- [x] `syncRunId` por `syncAll()`
- [x] Errores en nivel `error` (`logErr`)
- [x] Commit (`8f51dcc` principal + `4aa1b1a` fix de destructuring)

### Validación Fase 2
- [x] Smoke test: un sync completo no rompe
- [x] Smoke test: matar sync a mitad → la DB no queda con huecos (rollback verificado)
- [x] Health endpoint reporta OK
- [x] Logs JSON en producción
- [x] Issues encontrados: documentados en commits

---

## 📌 Fase 3 — Modelo de datos (migraciones)

> Plan: [03-data-model.md](./03-data-model.md)

### Pre-requisitos Fase 3
- [x] Pre-validación de huérfanos en FKs candidatas (17 huérfanos encontrados)
- [x] Backfill de 5 competidores faltantes desde `games.data` JSONB
- [x] Limpieza de 15 huérfanos en cache (game_stats, odds_lines)
- [x] Tablas con CHECK vacías (apuestas, selecciones, eventos) — sin riesgo

### 3.1 — Tabla `competition_competitors`
- [ ] **DEFERIDO**: impactaría controller queries no migradas. Se haria en iter futura.
- [ ] Migration `018_competition_competitors.sql` — pendiente
- [ ] Modificar `syncGamesForComp`, `syncStandingsForComp`, `syncCatalog`
- [ ] Modificar `transfersController.js` para usar la nueva tabla
- [ ] Modificar `utils/competition.js`
- [ ] (Posterior) `019_drop_competitors_competition_id.sql`

### 3.2 — Foreign keys
- [x] Pre-validar huérfanos para cada FK
- [x] Crear `016_foreign_keys.sql` con 3 FKs seguras (apuestas, equipos_seguidos, historial → usuarios)
- [x] Tests negativos (INSERT huérfano falla)
- [x] Commit (parte de `983bc2a`)
- [ ] **SKIPPED**: FKs en cache tables (game_stats, news, etc.) por riesgo de orden en sync

### 3.3 — Índices pendientes
- [x] Pre-validar con EXPLAIN
- [x] Crear `014_add_indexes.sql` con 9 índices
- [x] Tests de performance
- [x] Commit (parte de `983bc2a`)

### 3.4 — Constraints CHECK
- [x] Pre-validar valores fuera del CHECK
- [x] Crear `015_check_constraints.sql`
- [x] Commit (parte de `983bc2a`)

### 3.5 — `bet_followers` normalizado
- [ ] **DEFERIDO**: requiere refactor de handlers completo. Esperar a iter futura.

### 3.6 — Arreglar migrations previas
- [x] Reescribir `007_athletes_canonical.sql` para deduplicar primero
- [x] Reescribir `004_scores365_data.sql` con parent first
- [x] Crear `013_schema_migrations.sql` (tracking table)
- [x] Documentar procedimiento en `migration-supabase-vercel.md`
- [x] Commit (parte de `983bc2a`)

### 3.7 — `venues` y `eventos_apuesta`
- [ ] **PENDIENTE DE CONFIRMACIÓN** — no tocar por instrucción del usuario

### 3.8 — Timezone en baseline tables
- [x] Pre-validar fechas existentes
- [x] Crear `017_baseline_to_timestamptz.sql`
- [x] Tests pasan (tablas vacías, sin riesgo)
- [x] Commit (parte de `983bc2a`)

### Validación Fase 3
- [x] Tests completos pasan
- [x] Anotar issues encontrados (huérfanos limpiados, falta competition_competitors)

---

## 📌 Fase 4 — Migración a Supabase JS (HTTP)

> Plan: [04-supabase-js-migration.md](./04-supabase-js-migration.md)

### Pre-requisitos Fase 4
- [ ] **PENDIENTE**: Añadir `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel como env vars para activar el path HTTP
- [x] `pg.Pool` y conexión pg verificados en Supabase

### 4.0 — Decisión arquitectónica
- [x] Documentar la decisión dual strategy (HTTP para simple, pg para CTE/JSONB)
- [x] Estrategia dual con fallback: si SUPABASE_URL no seteado → wrapper hace fallback a pg automáticamente

### 4.1 — Capa de abstracción
- [x] Crear `database/supabaseClient.js` con fallback
- [x] Crear `database/db.js` con helpers (query, insert, upsert, update, remove, execAdvanced)
- [x] Reducir `database/connection.js` a pg-only con `max: 1` (commit en `4ac76ef` Phase 2)
- [x] `application_name: 'scorehub-pg-fallback'` distingue de cualquier conexión directa
- [x] Commit (`e4e10fd`)

### 4.2 — Refactor de repositories y servicios
- [x] **Iteración 1**: `infoController.js` — 7 handlers migrados a HTTP/dual. Commit (`e4e10fd`).
- [x] **Iteración 2**: `standingController.js` (3 handlers) + `transfersController.js` (3 handlers) — HTTP donde aplica, pg para CTE/JOINs. Commit (`4eaccde`).
- [x] **Iteración 3**: `newsController.js`, `statsController.js`, `trendController.js`, `teamController.js`, `teamEnhancementsController.js`, `historyController.js`, `athleteController.js` — mixed HTTP + pg. Commit (`dcf1142`).
- [x] **Iteración deferida**: `matchController.js` — 20 queries multi-LEFT-JOIN / JSONB filters, refactor a PostgREST requiere rewrite mayor. Mantiene `pool` import. Pendiente para iter futura tras decidir approach PostgREST.

### 4.3 — Estrategia dual
- [x] Queries complejas (CTE, JOINs 3+ tablas, JSONB casts) usan `db.execAdvanced` (pg)
- [x] Queries single-table con `eq`, `in`, `order`, `limit`, `maybeSingle` usan `db.query` (HTTP)
- [x] DB.stats expuesto vía `/api/football/health`

### 4.4 — Settings de Vercel
- [ ] **PENDIENTE**: añadir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en env de Vercel
- [x] `SUPABASE_DB_URL` se mantiene para pg-only
- [x] `DB_POOL_MAX=1` ya en código

### 4.5 — Observabilidad
- [x] Crear `utils/dbStats.js` con counters
- [x] Health endpoint reporta `dbStrategy` + `dbStats`
- [ ] **OBJETIVO POST-ACTIVAR SUPABASE**: ratio >80% por Supabase HTTP

### 4.6 — Caché y migración de handlers/sync
- [ ] **PENDIENTE**: actualizar `services/mundialCache.js` y `handlers/*.js` para usar el wrapper (muchas queries de cache y follow podrían HTTP-ear)
- [ ] **PENDIENTE**: actualizar `services/syncService.js` (mayor refactor)

### Validación Fase 4
- [x] Tests pasan (con único test pre-existente del health)
- [x] TypeScript limpio
- [x] Lint 0 errores
- [x] Build OK
- [x] Deploy a producción OK con `dbStrategy: "http+pg-fallback"`
- [x] Smoke test de los 9 endpoints migrados: comps, featured, detail, standings, transfer summary, transfers (100 items), topScorers, trends, insights

---

## 📌 Post-refactor

- [ ] Documentar la arquitectura final en `docs/` (incluir diagrama ER)
- [x] Actualizar `docs/migration-supabase-vercel.md` con procedure + tabla de migrations aplicadas
- [x] Actualizar `docs/env-vars.md` (parcialmente en `.env.example`)
- [ ] Eliminar código muerto detectado durante refactor
- [ ] Revisar y eliminar warnings de ESLint acumulados
- [ ] Considerar upgrade a TanStack Query para reemplazar hooks custom
- [ ] Activar Supabase HTTP en Vercel (pendiente env vars)

## Estado global

| Fase | Items completados | Items pendientes | Estado |
|---|---|---|---|
| 1 | 5/5 (todos los cambios) | — | ✅ |
| 2 | 5/5 (helpers + tx + source + index + logger) | — | ✅ |
| 3 | 4/8 (indexes + CHECKs + FKs + TIMESTAMPTZ) | 4 (competition_competitors, bet_followers_v2, 004/007 logic, full ER docs) | ⚠️ parcial |
| 4 | 5/8 (wrapper + health + 9 controllers) | 3 (env vars, matchController, syncService, handlers) | ⚠️ parcial |

**Trabajo futuro recomendado** (no urgente):
1. Activar Supabase JS en prod con SUPABASE_URL + SERVICE_ROLE_KEY — medible vía `dbStats` health endpoint
2. Migrar `matchController.js` a `db.query` + `db.execAdvanced` mixto
3. Migration `018` para `competition_competitors` table (multi-competitor FK correcto)
4. Normalizar `bet_followers` (migration `019` + handlers)
5. Migrar `services/syncService.js` (uso de db wrapper para queries que no necesitan CTE)
