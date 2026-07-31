# Sync Schedule — ScoreHub

Documento permanente que describe el calendario completo de syncs ETL
(extract-transform-load) que mantiene la base de datos actualizada con datos
de la API de 365scores. Lista los 23 jobs, su frecuencia, qué hacen y
de dónde vienen los datos.

> **Última actualización:** Fase 8.6+ — 30 julio 2026
> **Total de jobs:** 24 + 1 inicial
> **Tecnología:** `node-cron` con `jobGuard` anti-solapamiento
> **Host:** PM2 (`scores365-sync`) en este server (no Vercel)

---

## 1. Resumen por frecuencia

| Frecuencia | # Jobs | Categoría |
|---|---|---|
| 15 s | 2 | Live (gaming en vivo) |
| 60 s | 3 | Games (resultados + fixtures) |
| 2 m | 3 | Standings + Trends + Bet selections |
| 5 m | 2 | Predictions + Odds |
| 10 m | 8 | Detalles, athletes, news, etc. |
| 30 m | 2 | Suggestions + trend details |
| 6 h | 3 | Transfers, catalog, countries |
| 24 h | 1 | Competition history |
| **Total** | **24** | |

Más 1 `syncAll()` que corre al startup del proceso y re-ejecuta los 22 jobs secuencialmente en background.

---

## 2. Cada 15 segundos — Live

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncLiveGames` | `getGamesCurrent(compId)` × 7 comps | `games`, `competition_competitors` |
| `syncLiveStats` | `getGameStats(gameId)` × games con `status_group=1` | `game_stats` |

> **Por qué tan rápido**: para que el bot y el dashboard reflejen marcadores en vivo casi en tiempo real. La latencia objetivo es < 30s.

---

## 3. Cada 60 segundos — Games

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncGames` | (no-op desde Fase 8.1) | — |
| `syncGamesResults` | `getGamesResults(compId)` × 7 comps | `games` (finalizados) |
| `syncFixtures` | `getFixtures(compId)` × 7 comps | `games` (próximos) |

> **Nota sobre `syncGames`**: en Fase 8.1 descubrimos que el endpoint `getGamesAllScores` global devolvía 0 games para nuestras competiciones activas (el feed global no las incluye). Se hizo no-op. La cobertura se logra con `syncFixtures` + `syncGamesResults` per-comp.

---

## 4. Cada 2 minutos

| Job | Fuente | Tabla(s) destino |
|---|---|---|
| `syncStandings` | `getStandings(compId, stageNum, seasonNum)` × 7 comps | `standings`, `competition_competitors` |
| `syncTrends` | `getTrends('competition', compId)` × 7 comps | `trends` (atomic DELETE+INSERT en tx) |
| `syncBetSelections` | (no API) — evalúa `apuesta_selecciones` cuyo partido terminó | `apuesta_selecciones` (estado, valor_actual) |

---

## 5. Cada 5 minutos

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncPredictions` | `getPredictions(sports=1)` | `predictions` (filtrado por competitors en `competitors`, Fase 8.6) |
| `syncOdds` | `getOddsLines(gameId)` × games activos | `odds_lines` |

> **Sobre `syncPredictions`**: el feed upstream devuelve siempre los mismos 5 games de "amistosos pre-temporada" (comp 113, 321, 7685). En Fase 8.6 cambiamos el filtro: ahora aceptamos cualquier game cuyo `home_competitor_id` o `away_competitor_id` esté en `competitors`. Resultado: 3+ predicciones por sync (Manchester City vs Inter, etc.).

---

## 6. Cada 10 minutos — Detalles + contenido

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncBrackets` | `getBrackets(compId)` (solo comp=5930 Mundial) | `brackets` |
| `syncTournamentStats` | `getTournamentStats(compId, seasonNum)` × 7 comps | `tournament_stats` |
| `syncTeamOfWeek` | `getTeamOfWeek(compId)` × 7 comps | `team_of_week` |
| `syncGameDetails` | 5 endpoints × 25 games (status=1,2,4) | `game_overviews`, `game_h2h`, `game_pre_stats`, `game_lineups`, `game_stats` |
| `syncOutrights` | `getOutrights(compId)` × 7 comps | `odds_outrights` |
| `syncVenues` | extrae de `game_overviews.data.game.venue` | `venues` |
| `syncAthletes` | roster desde `game_lineups.members` + hidratación via `getAthlete` | `athletes` |
| `syncNews` | `getNews('competition', compId)` × 7 comps | `news` |

> **Sobre `syncGameDetails`**: 5 calls × 25 games = 125 requests por corrida. Con timeout de 30s por game (Fase 8.1) y `jobGuard` anti-solapamiento. Endpoints: overview, h2h, pre-stats, lineups, stats.
>
> **Sobre `syncAthletes`**: solo hidrata los profiles que están stale (>24h) o sin `data.trophies/transfers/career`. La hidratación per-athlete hace 1 request por profile no-fresco.

---

## 7. Cada 30 minutos

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncSuggestions` | `getGameSuggestions(compId)` × 7 comps | `game_suggestions` (atomic DELETE+INSERT) |
| `syncTrendDetails` | hidrata desde `trends` table stale (>30 min) | `trend_details` |

> **`syncTrendDetails` (Fase 8.3)**: solo hidrata los trends que están stale o sin data. Hasta 50 trends por corrida, llamando `getTrendDetails(trendId)` per-trend.

---

## 8. Cada 6 horas

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncTransfers` | `getTransfers(compId)` × 7 comps | `competition_transfers` + refs en `athletes` + `competitors` |
| `syncCatalog` | `getCompetition(compId)` + `getStandings` × 7 comps | `competitions` + `competitors` (canonical, source='catalog') |
| `syncCountries` | extrae de `getTopCompetitors` | `countries` |

> **Por qué 6h y no más rápido**: estos datos cambian poco (fichajes, estructura de competición, países). El cron a las 0, 6, 12, 18h.

---

## 9. Cada 24 horas (3 AM)

| Job | Fuente (365scores API) | Tabla(s) destino |
|---|---|---|
| `syncCompetitionHistory` | `getCompetitionHistory(compId)` × 7 comps (con `hasHistory`) | `competition_history` |

> **Por qué 3 AM**: minimiza el tráfico durante horas pico.

---

## 10. Al startup — `syncAll()`

Cuando PM2 arranca el proceso `scores365-sync` (o después de un restart manual), se ejecuta `sync.syncAll()`:

```
syncAll() ejecuta los 22 jobs secuencialmente:
  catalog.syncCatalog()           ← 1ra
  catalog.syncCountries()
  games.syncLiveGames()
  games.syncGamesResults()
  games.syncFixtures()
  standings.syncStandings()
  content.syncBrackets()
  content.syncTournamentStats()
  content.syncTeamOfWeek()
  content.syncCompetitionHistory()
  content.syncNews()
  trendsOdds.syncTrends()
  trendsOdds.syncTrendDetails()
  trendsOdds.syncPredictions()
  trendsOdds.syncOutrights()
  trendsOdds.syncOdds()
  details.syncLiveStats()
  athletes.syncVenues()
  transfers.syncTransfers()
  transfers.syncSuggestions()
  log('Full sync complete')
```

> **Fase 8.1 fix**: `syncAll()` corre en **background** (fire-and-forget con `.catch()`). No bloquea el startup si un job tarda — los crons tienen `jobGuard` que evita que se solapen.

---

## 11. Tecnología de scheduling

### `node-cron`
- Librería estándar de cron expressions
- 5 campos (segundo + minuto + hora + día-mes + mes + día-semana)
- 6 campos con segundos: `* * * * * *`

### `jobGuard` (anti-solapamiento)
- **Archivo**: `utils/jobGuard.js`
- **Función**: previene que un job se ejecute concurrentemente consigo mismo
- **Mecanismo**: `Map<name, running>`. Si un job ya está en curso, los siguientes calls son skipped con `[jobGuard] "<name>" saltada: ya en curso`
- **Fase 8.1 fix**: necesario porque `syncLiveGames` (cron 15s) a veces tarda >15s

### PM2 (Process Manager 2)
- Mantiene el proceso vivo
- Reinicia si crashea
- Logs en `/home/pocho/.pm2/logs/scores365-sync-{out,error}.log`
- Script entry: `sync.js`

### `pgQueryRetry` (Fase 8.1 fix)
- Reintentos automáticos para errores de red (timeout, ECONNRESET)
- Backoff exponencial: 250ms, 750ms
- Aplicado a `db.js`, `syncWriters.js`

---

## 12. Monitoreo

```bash
# Ver estado del proceso
pm2 list

# Ver logs en vivo
pm2 logs scores365-sync

# Ver último log del sync
tail -50 /home/pocho/.pm2/logs/scores365-sync-out.log

# Freshness en DB
psql -c "SELECT tablename, MAX(age(now(), updated_at))::interval as age 
        FROM pg_stat_user_tables st JOIN pg_class c ON c.oid = st.relid 
        WHERE c.relnamespace = 'public'::regnamespace 
        GROUP BY tablename ORDER BY age DESC;"
```

Health endpoint en Vercel (`https://scorehub-pocho.vercel.app/api/football/health`):
```json
{
  "dbStrategy": "http+pg-fallback",
  "dbStats": {
    "supabaseCalls": 5,
    "pgCalls": 0,
    "readThroughCalls": 1,    // Fase 8.6: se incrementa en cada readThrough
    "upsertsFromCacheMiss": 0, // solo en write-backs reales
    "supabasePercent": 100
  }
}
```

---

## 13. Cómo añadir un nuevo sync

1. Implementar la función en `src/application/sync/<módulo>.js`:
   ```js
   async function syncMyNewThing() {
     // lógica del sync
   }
   module.exports.syncMyNewThing = syncMyNewThing;
   ```

2. Registrar en `src/interface/scheduler/scheduler.js`:
   ```js
   every('*/15 * * * *', 'syncMyNewThing', sync.syncMyNewThing);
   ```

3. Añadir a `syncAll()` en `src/application/sync/syncService.js`:
   ```js
   await myModule.syncMyNewThing();
   ```

4. Añadir test en `tests/sync.golden.test.js`:
   ```js
   test('syncMyNewThing → descripción', async () => {
     // mock + assert
   });
   ```

5. Añadir regla de freshness en `tests/sync.freshness.test.js`:
   ```js
   { table: 'my_new_table', maxAgeHours: 5, note: 'cron 15min' },
   ```

---

## 14. Referencias cruzadas

- `docs/architecture/db-coverage.md` — qué datos están en cada tabla
- `docs/refactor-plans/09-db-frescura-y-salud.md` — Fase 8.1: pgQueryRetry, syncGames no-op
- `docs/refactor-plans/11-db-cobertura-completa.md` — Fase 8.3: 5 endpoints cerrados
- `docs/refactor-plans/12-db-write-back-cache.md` — Fase 8.4: readThrough + write-back
- `docs/refactor-plans/14-db-limitations-fase-86.md` — Fase 8.6: 5 paths API corregidos

---

## 15. Historial de cambios

| Fecha | Cambio | Por qué |
|---|---|---|
| Julio 2026 | Creación de los 23 jobs | Setup inicial post-migración a Supabase |
| 2026-07-24 | Migrations 002-019 aplicadas | Esquema completo |
| 2026-07-24 | Migration 016 (FKs + CHECKs) | Constraints aplicadas (verificado en auditoría Fase 8.6) |
| 2026-07-29 | Fase 8.1: `pgQueryRetry`, timeouts, `syncAll` background, `syncGames` no-op | Sync no zombie-aba |
| 2026-07-29 | Fase 8.3: `syncTrendDetails`, 5 endpoints cerrados | Reducir dependencia de 365 |
| 2026-07-29 | Fase 8.4: 11 endpoints con `readThrough()` | Write-back automático |
| 2026-07-29 | Fase 8.5: Supabase HTTP activado en Vercel | Reducir carga en pg pool |
| 2026-07-29 | Fase 8.6: 5 paths API con slash final, `syncPredictions` por competitors | Cerrar 3 limitaciones |
| 2026-07-30 | `readThroughCalls` se incrementa en cada llamada (no solo write-back) | Auditoría Fase 8.6 |
| 2026-07-30 | Añadido `syncBetSelections` (cada 2m) — evalúa selecciones pendientes automáticamente | Fase 8.6+ |
| 2026-07-31 | Migration 022: 3 nuevas competiciones (Eurocopa 6316, Copa América 595, CONCACAF Centroamericana 7954). Excluida: CONCACAF Copa de Campeones (171) | Fase 8.7+ |
| 2026-07-31 | Migration 023: 3 nuevas competiciones Américas (Liga MX 141, MLS 104, Liga Argentina 72). Total: 13 active competitions | Fase 8.7+ |
| 2026-07-31 | Fix TeamDetailPage.tsx:181: "← Ver en {mainCompName}" — resuelve nombre de competición dinámicamente en lugar de hardcodear Mundial/Liga Promerica | Fase 8.7+ |
| 2026-07-31 | Tests del dashboard: 27 tests verdes (8 selector + 19 standings) verificando las 6 nuevas competiciones en producción | Fase 8.7+ |
| 2026-07-31 | Documentación: `db-coverage.md` actualizada con tabla de estado de integración del dashboard | Fase 8.7+ |

---

*Generado como parte de la auditoría final de Fase 8.6 (julio 2026).*
