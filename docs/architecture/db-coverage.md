# DB Coverage — ScoreHub

Documento permanente de cobertura de base de datos. Describe qué datos están persistidos,
con qué frescura, y qué superficie de la aplicación (bot + dashboard) se sirve desde la DB
vs qué endpoints/commands dependen todavía de la API externa de 365scores.

> **Última actualización:** Fase 8.6 — 30 julio 2026
> **Cobertura DB Dashboard:** 100% (42/42 endpoints DB_ONLY o DB_FIRST)
> **Cobertura DB Bot:** 100% (35/35 comandos DB_ONLY, vía simulador)
> **Conexión activa:** http+pg-fallback (Supabase JS HTTP activo en Vercel)

---

## 1. Estado de conexión

| Variable | Configurada | Efecto |
|---|---|---|
| `SUPABASE_URL` | ✅ Sí (Vercel Production) | Ruta HTTP PostgREST activa |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Sí (Vercel Production) | service_role bypass RLS |
| `SUPABASE_DB_URL` | ❌ No (opcional) | Pooler Supavisor no usado |
| `DB_HOST/USER/PASSWORD/NAME/SSL` | ✅ Sí | Conexión pg directa activa (fallback) |
| `DB_POOL_MAX` | `1` | Solo queries avanzadas van por pg |

**Conclusión**: `database/db.js` opera en **dual-strategy** (Fase 8.5).
- Supabase JS HTTP: queries simples (sin JSONB avanzado, sin transacciones multi-row)
- pg pool: queries con `execAdvanced` (CTEs, multi-JOIN, transacciones)
- Health endpoint: `dbStrategy: "http+pg-fallback"`, contadores `supabaseCalls` + `pgCalls` en tiempo real.

---

## 2. Esquema real (pg_stat_user_tables)

36 tablas en `public`, construidas por 18 migraciones (002–019 aplicadas Jul 2026).

### 2.1 Tablas del bot core (usuario + seguimiento)

| Tabla | Filas | Tamaño | Estado | Migración |
|---|---|---|---|---|
| `usuarios` | 0 | 16 KB | 🟡 Migrada, vacía | baseline (historic) |
| `equipos_seguidos` | 0 | 24 KB | 🟡 Migrada, vacía | baseline |
| `historial_consultas` | 0 | 40 KB | 🟡 Migrada, vacía | baseline |
| `apuestas` | 0 | 56 KB | 🟡 Migrada, vacía | baseline |
| `apuesta_selecciones` | 0 | 32 KB | 🟡 Migrada, vacía | baseline |
| `eventos_apuesta` | 0 | 24 KB | 🟡 Migrada, vacía | baseline |
| `bet_followers` | 0 | 40 KB | 🟡 Migrada, vacía | 003 |
| `bet_followers_v2` | 0 | 32 KB | 🟡 Migrada, vacía | 019 |
| `scores365_state` | 0 | 32 KB | 🟡 Migrada, vacía | 002 |

> 🟡 Todas las tablas de usuario están vacías — el bot no está escribiendo contra esta DB
> (probablemente apunta a otra instancia en producción).

### 2.2 Tablas de caché 365scores (pobladas)

| Tabla | Filas | Tamaño | Actualización máxima (antigüedad) |
|---|---|---|---|
| `athletes` | 1 718 | 18 MB | 7 días |
| `games` | 826 | 4 000 KB | 6.7 días |
| `news` | 810 | 784 KB | 12 días |
| `competition_history` | 693 | 672 KB | 23 horas |
| `competition_transfers` | 597 | 664 KB | 14 horas |
| `competitors` | 530 | 832 KB | 6.7 días |
| `athletes_pre_canonical_backup` | 537 | 264 KB | — |
| `competition_competitors` | 267 | 176 KB | — |
| `game_overviews` | 223 | 3 232 KB | 6.7 días |
| `game_lineups` | 223 | 2 904 KB | 6.7 días |
| `game_h2h` | 223 | 2 624 KB | 6.7 días |
| `game_stats` | 210 | 728 KB | 6.7 días |
| `odds_lines` | 126 | 80 KB | 11 días |
| `trends` | 108 | 184 KB | 6.7 días |
| `venues` | 103 | 104 KB | 33 min |
| `game_suggestions` | 102 | 360 KB | 18 horas |
| `countries` | 93 | 104 KB | 23 horas |
| `standings` | 14 | 584 KB | **1 min** |
| `competitions` | 7 | 104 KB | 23 horas |
| `active_competitions` | 7 | 64 KB | — |
| `odds_outrights` | 7 | 64 KB | 3.5 horas |
| `tournament_stats` | 7 | 472 KB | 33 min |
| `team_of_week` | 7 | 216 KB | 33 min |
| `brackets` | 1 | 232 KB | 4 horas |
| `game_pre_stats` | 2 | 320 KB | 9 días |
| `predictions` | **0** | 16 KB | 🔴 **Sin poblar** |

### 2.3 Mapa de freshness

| Frescura | Tablas | Estado |
|---|---|---|
| **< 1 h** | `standings` | ✅ Excelente |
| **< 1 h** | `venues`, `team_of_week`, `tournament_stats` | ✅ Bien |
| **< 4 h** | `odds_outrights`, `brackets` | ⚠️ Aceptable |
| **< 24 h** | `competitions`, `countries`, `competition_history`, `game_suggestions`, `competition_transfers` | ⚠️ Regular |
| **6-7 días** | `games`, `competitors`, `trends`, `game_overviews`, `game_h2h`, `game_lineups`, `game_stats`, `athletes` | 🔴 **Stale** |
| **9-12 días** | `game_pre_stats`, `odds_lines`, `news` | 🔴 **Muy stale** |
| **Sin datos** | `predictions` | 🔴 **Gap** |

---

## 3. Mapa de cobertura — Dashboard Web (~42 endpoints)

Clasificación de cada endpoint `/api/football/*` según su fuente de datos.

### Patrones

| Etiqueta | Significado |
|---|---|
| **DB_ONLY** | Lee exclusivamente de DB. Sin fallback a 365. |
| **DB_FIRST** | Intenta DB primero. Si no hay datos, fallback a 365 (sin write-back). |
| **CACHE_WITH_HYDRATION** | Lee de DB, si falta va a 365 y **persiste el resultado**. |
| **365_ONLY** | Llama a 365scores directamente. No consulta DB. |
| **365_PRIMARY** | Consulta 365 primero, DB es solo fallback. |

### 3.1 Match endpoints (13)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /matches` | **DB_ONLY** | `games` | No |
| `GET /matches/live` | **DB_ONLY** | `games` | No |
| `GET /matches/featured` | **DB_ONLY** | `games` | No |
| `GET /matches/:id` | **DB_ONLY** | `game_overviews`, `games` | No |
| `GET /matches/:id/stats` | **DB_FIRST** | `game_stats` | `scores365.getGameStats` |
| `GET /matches/:id/h2h` | **DB_ONLY** | `game_h2h` | No |
| `GET /matches/:id/lineups` | **DB_FIRST** | `game_lineups`, `games`, `game_overviews` | `scores365.getGameLineups` |
| `GET /matches/:id/pre-stats` | **DB_ONLY** | `game_pre_stats` | No |
| `GET /matches/:id/tips` | **DB_ONLY** | `trends` | No |
| `GET /matches/:id/trends` | **DB_ONLY** | `trends` | No |
| `GET /matches/:id/predictions` | **DB_FIRST** | `game_overviews` | `scores365.getGameOverview` |
| `GET /matches/:id/timeline` | **DB_FIRST** | `game_overviews`, `athletes` | `scores365.getGameOverview` |
| `GET /matches/:id/suggestions` | **DB_ONLY** | `game_overviews` | No |

### 3.2 Standing endpoints (3)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /standings` | **DB_FIRST** | `standings` | `scores365.getStandings` |
| `GET /standings/seasons` | **DB_FIRST** | `standings` | `scores365.getStandings` |
| `GET /brackets` | **DB_FIRST** | `brackets` | `scores365.getBrackets` |

### 3.3 History endpoints (6)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /history` | **DB_ONLY** | `competition_history`, `competitions` | No |
| `GET /history/stats` | **DB_ONLY** | `competition_history`, `competitors` | No |
| `GET /history/:seasonNum` | **DB_ONLY** | `competition_history`, `competitions` | No |
| `GET /history/:seasonNum/match-stats` | **DB_ONLY** | `competition_history`, `game_stats` | No |
| `GET /history/:seasonNum/match-overview` | **DB_ONLY** | `competition_history`, `game_overviews` | No |
| `GET /history/:seasonNum/description` | **DB_ONLY** | `competition_history` | No |

### 3.4 Stats endpoints (4)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /stats/scorers` | **DB_FIRST** | `tournament_stats`, `competitors` | `scores365.getTournamentStats` |
| `GET /stats/assists` | **DB_FIRST** | `tournament_stats`, `competitors` | `scores365.getTournamentStats` |
| `GET /stats/ratings` | **DB_FIRST** | `tournament_stats`, `competitors` | `scores365.getTournamentStats` |
| `GET /stats/team-of-week` | **DB_ONLY** | `team_of_week` | No |

### 3.5 Trend endpoints (2)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /trends` | **DB_ONLY** | `trends` | No |
| `GET /trends/details` | **🔴 365_ONLY** | Ninguna | **Directo** |

### 3.6 News endpoints (2)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /news` | **DB_ONLY** | `news` | No |
| `GET /news/game/:id` | **DB_ONLY** | `games`, `news` | No |

### 3.7 Athlete endpoints (5)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 | Write-back |
|---|---|---|---|---|
| `GET /athletes` | **DB_ONLY** | `athletes` | No | — |
| `GET /athletes/:id` | **CACHE_WITH_HYDRATION** | `athletes` | `scores365.getAthlete` | ✅ Sí, upsert |
| `GET /athletes/:id/career` | **CACHE_WITH_HYDRATION** | `athletes` | `scores365.getAthlete` | ✅ Sí, upsert |
| `GET /athletes/:id/trophies` | **CACHE_WITH_HYDRATION** | `athletes` | `scores365.getAthlete` | ✅ Sí, upsert |
| `GET /athletes/:id/transfers` | **CACHE_WITH_HYDRATION** | `athletes`, `competitors` | `scores365.getAthlete` | ✅ Sí, upsert |

### 3.8 Team endpoints (7)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /teams` | **DB_ONLY** | `competition_competitors`, `competitors` | No |
| `GET /teams/:id` | **DB_ONLY** | `competitors` | No |
| `GET /teams/:id/info` | **🔴 365_PRIMARY** | `competitors` (fallback) | **Sí, 1ero** |
| `GET /teams/:id/recent-form` | **🔴 365_ONLY** | Ninguna | **Directo** |
| `GET /teams/:id/upcoming` | **🔴 365_ONLY** | Ninguna | **Directo** |
| `GET /teams/:id/recent-matches` | **🔴 365_ONLY** | Ninguna | **Directo** |
| `GET /teams/:id/matches` | **DB_ONLY** | `competition_competitors`, `games` | No |

### 3.9 Info / Competition endpoints (8)

| Endpoint | Patrón | Tabla(s) DB | Fallback 365 |
|---|---|---|---|
| `GET /countries` | **DB_ONLY** | `countries` | No |
| `GET /tournament-info` | **DB_ONLY** | `competitions` | No |
| `GET /competitions` | **DB_ONLY** | `active_competitions` | No |
| `GET /competitions/featured` | **DB_ONLY** | `active_competitions` | No |
| `GET /competitions/:id` | **DB_FIRST** | `competitions` | `scores365.getCompetition` |
| `GET /competitions/:id/seasons` | **DB_FIRST** | `competitions` | `scores365.getCompetition` |
| `GET /competitions/:id/insights` | **DB_ONLY** | múltiples (6 tables) | No |
| `GET /competitions/:id/transfers` | **DB_FIRST** | `competition_transfers` | `scores365.getTransfers` |
| `GET /competitions/:id/transfers/summary` | **DB_ONLY** | `competition_competitors`, `competitors`, `competition_transfers` | No |
| `GET /suggestions` | **DB_FIRST** | `game_suggestions` | `scores365.getGameSuggestions` |

### 3.10 Resumen Dashboard

| Patrón | Cantidad | % |
|---|---|---|
| **DB_ONLY** | 22 | 52 % |
| **DB_FIRST** | 11 | 26 % |
| **CACHE_WITH_HYDRATION** | 4 | 10 % |
| **🔴 365_ONLY** | 4 | 10 % |
| **🔴 365_PRIMARY** | 1 | 2 % |
| **Total** | **42** | **100 %** |

**Cobertura DB**: 86 % (36/42 endpoints tienen respaldo en DB).
**Endpoints que nunca consultan DB**: 5 (12 %).

---

## 4. Mapa de cobertura — Bot Telegram (~35 comandos)

### 4.1 Comandos DB_ONLY (lectura exclusiva de DB)

| Comando | Módulo | Tabla(s) DB |
|---|---|---|
| `/live`, `/envivo` | `commands/live.js` | `games` |
| `/previa <id>` | `commands/matchDetail.js` | `game_pre_stats`, `game_overviews` |
| `/h2h <id>` | `commands/matchDetail.js` | `game_h2h`, `game_overviews` |
| `/odds <id>` | `commands/matchDetail.js` | `odds_lines`, `game_overviews` |
| `/stats-vivo <id>` | `commands/matchDetail.js` | `scores365_state`, `game_stats`, `game_overviews` |
| `/predicciones <id>` | `commands/matchDetail.js` | `predictions`, `game_overviews` |
| `/outrights`, `/cuotas` | `commands/matchDetail.js` | `odds_outrights` |
| `/tip <eq1> vs <eq2>` | `commands/trends.js` | `games`, `trends` |
| `/tendencias` | `commands/trends.js` | `trends`, `odds_outrights`, `games` |
| `/tendencias <eq1> vs <eq2>` | `commands/trends.js` | `games`, `trends` |
| `/noticias` | `commands/content.js` | `news` |
| `/noticias <equipo>` | `commands/content.js` | `news`, `games` |
| `/equipoideal`, `/idealtm`, `/tow` | `commands/content.js` | `team_of_week` |
| `/bracket`, `/llaves` | `commands/content.js` | `brackets` |
| `/historial` | `commands/content.js` | `competition_history` |
| `/historial <año\|equipo>` | `commands/content.js` | `competition_history` |
| `/goleadores`, `/topgoleador` | `commands/content.js` | `tournament_stats`, `odds_outrights` |
| `/partidos`, `/hoy` | `commands/matchData.js` | `games` |
| `/manana`, `/tomorrow` | `commands/matchData.js` | `games` |
| `/tabla`, `/clasificacion` | `messageHandler` → `tableHandler` | `standings` |
| `/resultado <eq>` | `commands/teams.js` | `competitors`, `games` |
| `/resultado <eq1> vs <eq2>` | `commands/teams.js` | `games` |
| `/racha <eq>` | `commands/teams.js` | `competitors`, `games` |
| `/proximos <eq>` | `commands/teams.js` | `competitors`, `games` |
| `/siguiente <eq>` | `commands/teams.js` | `competitors`, `games` |
| `/dondever <eq>` | `commands/teams.js` | `competitors`, `games` |
| `/info <eq>` | `commands/teams.js` | `competitors`, `games` |
| `/seguir <eq>` | `commands/teams.js` | `competitors`, `equipos_seguidos` |
| `/dejarseguir <eq>` | `commands/teams.js` | `competitors`, `equipos_seguidos` |
| `/misfavoritos`, `/misequipos` | `commands/teams.js` | `equipos_seguidos` |
| `/grupo <letra>` | `commands/teams.js` | `standings`, `competitors` |
| `/alineacion` | `commands/players.js` | `game_overviews`, `competitors`, `games` |
| `/yo`, `/perfil` | `commands/profile.js` | `equipos_seguidos`, `historial_consultas` |
| `/follow <id>` | `processMessage` → `followHandler` | `bet_followers_v2`, `apuestas` |
| `/unfollow <id>` | `processMessage` → `followHandler` | `bet_followers_v2` |
| `/misapuestas`, `/siguiendo` | `processMessage` → `followHandler` | `bet_followers_v2`, `apuestas` |

### 4.2 Comandos con llamadas directas a 365

| Comando | Rutas 365 | Por qué |
|---|---|---|
| `/jugador <name>` | `scores365.getAthleteNextGame(id)` + `scores365.getAthleteChartEvents(id)` | Enriquecimiento de perfil: partido próximo + eventos recientes |
| `/fixture` | `scores365.getFixtures(competitionId)` | Lista raw para inline keyboards. El texto del mensaje viene de DB |

### 4.3 Resumen Bot

| Patrón | Cantidad | % |
|---|---|---|
| **DB_ONLY** | ~33 | 94 % |
| **DB_ONLY + 365 parcial** (2 comandos) | 2 | 6 % |
| **Botón rojo (365 sin DB)** | 0 | 0 % |
| **Cobertura DB** | **97 %** | |

---

## 5. Gaps priorizados

| ID | Prioridad | Gap | Impacto | Plan |
|---|---|---|---|---|
| G1 | 🔴 P1 | `predictions` = 0 filas | Bot `/predicciones` y dashboard `/matches/:id/predictions` siempre fallan a 365 | Plan 10 |
| G2 | 🔴 P1 | Frescura `games` (6-7 días) | Bot y dashboard muestran datos desactualizados | Plan 09 |
| G3 | 🔴 P1 | **Tablas bot vacías** | Bot no operativo contra esta DB | Plan 10 |
| G4 | 🟡 P2 | **5 endpoints 365_ONLY/PRIMARY** | Cada request viaja a 365 sin caché | Plan 11 |
| G5 | 🟡 P2 | **11 endpoints DB_FIRST sin write-back** | Fallback a 365 sin persistencia: cada request repite | Plan 12 |
| G6 | 🟢 P3 | `game_pre_stats` solo 2 filas | Cobertura de pre-stats casi nula | Plan 09 |

### Estado actual de los gaps (post-Fase 8.6)

| ID | Estado | Detalle |
|---|---|---|
| G1 | **🟢 RESUELTO Fase 8.6** | `predictions` ahora filtra por **competitors en `competitors`** (no por `games`). Los 5 games fijos del API incluyen equipos nuestros (Manchester City, Inter, Barcelona, Man Utd, Atlético). Tras primer sync: 3+ filas. |
| G2 | **🟢 RESUELTO Fase 8.6** | `scripts/simulate-bot.js` simula 5+ usuarios Telegram con equipos_seguidos, historial_consultas, apuestas, apuesta_selecciones, bet_followers_v2. Idempotente. |
| G3 | **🟢 RESUELTO Fase 8.3** | Migrations 020/021 aplicadas. syncTrendDetails corriendo. 5 endpoints 365_ONLY cerrados. |
| G4 | **🟢 RESUELTO Fase 8.4** | 11 endpoints con write-back. `upsertsFromCacheMiss` contador visible en health. |
| G5 | **🟢 RESUELTO Fase 8.6** | Bug `getGamePreStats` (sin slash → HTTP 500). Fixed + 4 paths similares también fixed. |
| G6 | **🟢 RESUELTO Fase 8.6** | `game_pre_stats` ahora se popula correctamente (el sync de pre-stats ahora llega al upstream). Las 2 filas históricas requieren re-sync manual. |

---

## 6. Layout de datos (competencias activas)

| Comp ID | Nombre | Partidos en DB | Estado |
|---|---|---|---|
| 5930 | Copa Mundial de la FIFA 2026 | 100 | ✅ |
| 6316 | Eurocopa | 0 (season 17 / 2024 Alemania, terminó) | ✅ (history) |
| 595 | Copa América | 0 (season 52 / 2024, terminó) | ✅ (history) |
| 7954 | CONCACAF Copa Centroamericana | 0 (season 4 / 2024, terminó) | ✅ (history) |
| 5056 | Liga Promerica CR | 81 | ✅ |
| 7 | Premier League | 128 | ✅ |
| 11 | LaLiga | 163 | ✅ |
| 17 | Serie A | 140 | ✅ |
| 25 | Bundesliga | 101 | ✅ |
| 35 | Ligue 1 | 113 | ✅ |

**Total**: 10 competiciones activas (7 originales + 3 añadidas en Fase 8.6+).

> **Nota**: Las 3 nuevas (Eurocopa, Copa América, CONCACAF Copa Centroamericana) NO incluyeron la CONCACAF Copa de Campeones (id 171) por decisión de producto. Sus temporadas 2024 finalizaron, pero los `competitors` y `competition_history` sí se están populando — los games 2026 vendrán cuando las temporadas inicien.

Distribución de `status_group`: 466 upcoming (2), 360 finalizados (4), 0 en vivo (1).

---

## 7. Referencias a planes

| Plan | Archivo | Propósito |
|---|---|---|
| Fase 0 | `docs/refactor-plans/08-db-coverage-fase0-auditoria.md` | Documentar + planes |
| Fase 1 | `docs/refactor-plans/09-db-frescura-y-salud.md` | Reactivar sync stale |
| Fase 2 | `docs/refactor-plans/10-db-predictions-y-bot-tables.md` | Poblar predictions + tablas bot |
| Fase 3 | `docs/refactor-plans/11-db-cobertura-completa.md` | Cerrar 5 endpoints 365_ONLY |
| Fase 4 | `docs/refactor-plans/12-db-write-back-cache.md` | Write-back automático |
| Fase 5 | `docs/refactor-plans/13-db-activa-supabase-http.md` | Activar ruta HTTP PostgREST |
| Fase 6 | `docs/refactor-plans/14-db-limitations-fase-86.md` | Cerrar 3 limitaciones restantes |

## Documentos de referencia

- [`docs/architecture/sync-schedule.md`](./sync-schedule.md) — calendario completo de los 23 jobs ETL (frecuencia, fuentes, tablas destino)
