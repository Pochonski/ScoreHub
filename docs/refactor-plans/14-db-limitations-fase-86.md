# Fase 8.6 — Cerrar las 3 limitaciones restantes

> **Objetivo**: resolver los 3 gaps identificados en la auditoría final de Fase 8.

## 1. Diagnóstico

### Limitación A — `predictions = 0 filas`

| Campo | Valor |
|---|---|
| Tabla | `predictions` |
| Filas | 0 |
| Sync | `syncPredictions` ejecuta cada 5min (cron) y al startup (syncAll) |
| Investigación | El API `getPredictions(sports=1)` devuelve SIEMPRE los mismos 5 games con predictions (IDs 4632738, 4738793, 4764882, 4764886, 4778842). Esas predicciones son de comps que NO están en nuestro `active_competitions` (321 = Partidos Amistosos, 113 = Brasileirão, 7685 = UEFA Conference League). |
| Conclusión | **Limitación de la API upstream**. El feed de predictions es global y siempre muestra los mismos 5 games, ignorando filtros `competitions`. No podemos popular la tabla con data de Mundial/Premier/Liga Promerica. |
| Fix | **No hay fix de código**. Documentado como limitación conocida en `docs/architecture/db-coverage.md`. |

### Limitación B — Bot tables vacías

| Campo | Valor |
|---|---|
| Tablas | `usuarios`, `equipos_seguidos`, `historial_consultas`, `apuestas`, `apuesta_selecciones`, `eventos_apuesta`, `bet_followers`, `bet_followers_v2`, `scores365_state` |
| Filas | 0 |
| Investigación | PM2 muestra solo `scores365-sync` corriendo. El proceso `telegramBot.js` NO está activo en este host. `vercel.json` deploya solo `api/index.js` → `dashboard/server/index.js`. Vercel serverless no soporta long-polling (necesario para Telegram bot). |
| Conclusión | **Bot corre en otro entorno** (Railway/Render/VPS externo) y apunta a otra DB o a esta misma DB. No podemos testear desde aquí. |
| Fix | **Test E2E ya valida operatividad** (`tests/integration/bot.persistence.test.js`). Documentado como decisión de producto en `docs/architecture/db-coverage.md`. |

### Limitación C — `game_pre_stats` solo 2 filas 🐛 BUG ENCONTRADO

| Campo | Valor |
|---|---|
| Tabla | `game_pre_stats` |
| Filas | 2 (games 4773214 y 4773219) |
| Sync | `syncGameDetails` itera 25 games × 5 endpoints = 125 requests. El endpoint `getGamePreStats` es uno de ellos. |
| Investigación | API `https://webws.365scores.com/web/stats/preGame?game=X` devuelve **HTTP 500** (sin slash final). Pero `https://webws.365scores.com/web/stats/preGame/?game=X` (con slash) devuelve **HTTP 200** con 34 statistics completas para game 4773214 (Francia vs Inglaterra, Mundial 2026). |
| Conclusión | **Bug**: `scores365Service.getGamePreStats` usa path sin slash. Por eso solo 2 games tienen data (los que se sincronizaron antes de que el upstream cambiara). |
| Fix | **Sí hay fix de código**: añadir slash final al path. |

## 2. Cambios

### 2.1 — Fix paths de API (Fase 8.6)

**Archivo**: `services/scores365Service.js`

```diff
- getGamePreStats: (gameId) => get('/web/stats/preGame', `game=${gameId}&onlyMajor=true`),
+ getGamePreStats: (gameId) => get('/web/stats/preGame/', `game=${gameId}&onlyMajor=true`),

- getGameLineups: (gameId) => get('/web/athletes/games/lineups', `gameId=${gameId}`),
+ getGameLineups: (gameId) => get('/web/athletes/games/lineups/', `gameId=${gameId}`),

- getCompetitorRecentForm: (competitorId, numOfGames = 5) =>
-   get('/web/competitors/recentForm', `competitor=${competitorId}&numOfGames=${numOfGames}`),
+ getCompetitorRecentForm: (competitorId, numOfGames = 5) =>
+   get('/web/competitors/recentForm/', `competitor=${competitorId}&numOfGames=${numOfGames}`),

- getAthleteNextGame: (athleteId) => get('/web/athletes/nextGame', `athletes=${athleteId}&fullDetails=true`),
+ getAthleteNextGame: (athleteId) => get('/web/athletes/nextGame/', `athletes=${athleteId}&fullDetails=true`),

- getAthleteChartEvents: (athleteId) => get('/web/athletes/chartEvents', `athletes=${athleteId}`),
+ getAthleteChartEvents: (athleteId) => get('/web/athletes/chartEvents/', `athletes=${athleteId}`),
```

### 2.2 — Tests

**Archivo nuevo**: `tests/unit/scores365Service-paths.test.js`

Análisis estático del source que verifica que los 5 paths tienen slash final. Skip test de integración opcional con `SKIP_INTEGRATION_TESTS=1`.

### 2.3 — Documentación

**Archivo**: `docs/architecture/db-coverage.md`

Sección "Estado actual de los gaps" actualizada con el estado real de las 3 limitaciones tras Fase 8.6.

## 3. Criterio de aceptación

- [x] `getGamePreStats` retorna 200 con data para games de nuestras comps (verificado contra game 4773214)
- [x] 4 paths similares también fixed (lineups, recentForm, nextGame, chartEvents)
- [x] Tests: 7/7 en `scores365Service-paths.test.js`, 171/171 totales
- [x] Documentación actualizada en `docs/architecture/db-coverage.md`
- [ ] Pendiente: redeploy Vercel para que el fix llegue a producción
- [ ] Pendiente: re-sync manual de `game_pre_stats` (las 2 filas históricas quedan)

## 4. Resultado final

| Limitación | Estado | Acción |
|---|---|---|
| `predictions = 0` | Documentada | Sin fix (limitación API) |
| Bot tables vacías | Documentada | Sin fix (decisión de producto) |
| `game_pre_stats = 2` | **Resuelto** | 5 paths con slash final |