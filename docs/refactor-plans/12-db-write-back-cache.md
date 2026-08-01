# Fase 4 — Write-back automático en DB_FIRST

> **Objetivo**: cuando un endpoint DB_FIRST hace fallback a 365, persistir el resultado en DB
> para que los siguientes requests sean instantáneos (sin viaje a 365).

**Esfuerzo**: 4-6 horas · **Riesgo**: Medio ·
**Depende de**: Fase 3 (migraciones + nuevos sync jobs) · **Estado**: ⏳ Pendiente

---

## 1. Diagnóstico

11 endpoints del dashboard siguen el patrón DB_FIRST: intentan DB, y si no hay datos,
llaman a 365scores **pero nunca guardan el resultado**. Cada request subsiguiente
repite el viaje a 365:

| Endpoint | Tabla DB | 365 fallback |
|---|---|---|
| `GET /matches/:id/stats` | `game_stats` | `scores365.getGameStats` |
| `GET /matches/:id/lineups` | `game_lineups`, `games`, `game_overviews` | `scores365.getGameLineups` |
| `GET /matches/:id/predictions` | `game_overviews` | `scores365.getGameOverview` |
| `GET /matches/:id/timeline` | `game_overviews`, `athletes` | `scores365.getGameOverview` |
| `GET /standings` | `standings` | `scores365.getStandings` |
| `GET /standings/seasons` | `standings` | `scores365.getStandings` |
| `GET /brackets` | `brackets` | `scores365.getBrackets` |
| `GET /stats/scorers` | `tournament_stats`, `competitors` | `scores365.getTournamentStats` |
| `GET /stats/assists` | `tournament_stats`, `competitors` | `scores365.getTournamentStats` |
| `GET /stats/ratings` | `tournament_stats`, `competitors` | `scores365.getTournamentStats` |
| `GET /competitions/:id` | `competitions` | `scores365.getCompetition` |
| `GET /competitions/:id/seasons` | `competitions` | `scores365.getCompetition` |
| `GET /competitions/:id/transfers` | `competition_transfers` | `scores365.getTransfers` |
| `GET /suggestions` | `game_suggestions` | `scores365.getGameSuggestions` |

## 2. Solución propuesta

### 2.1 — Añadir helper `readThrough` en `database/db.js`

```js
/**
 * Read-through cache pattern.
 * 1. Intenta leer de DB
 * 2. Si no hay datos, llama a fetcher()
 * 3. Si fetcher devuelve datos, los persiste en DB
 * 4. Devuelve los datos + metada de fuente
 */
async function readThrough(table, queryOpts, fetcher, { onConflict = 'id' } = {}) {
  const { data, error } = await query(table, queryOpts);
  if (!error && data && (Array.isArray(data) ? data.length > 0 : data !== null)) {
    return { data, error: null, source: 'db' };
  }
  const result = await fetcher();
  if (result && !result.error && result.data) {
    await upsert(table, result.data, onConflict);
    dbStats.recordUpsert();
    return { data: result.data, error: null, source: '365+writeback' };
  }
  return result;
}

module.exports = { query, insert, upsert, update, remove, execAdvanced, readThrough };
```

### 2.2 — Refactor endpoints DB_FIRST

**Patrón ANTES** (ej. `matchController.getMatchStats`):
```js
async function getMatchStats(req, res) {
  const { gameId } = req.params;
  const { data } = await db.query('game_stats', {
    select: 'data', eq: { game_id: gameId }, single: true,
  });
  if (data) return res.json({ data });
  // fallback a 365 (sin persistencia)
  const fresh = await scores365.getGameStats(gameId);
  return res.json({ data: fresh });
}
```

**Patrón DESPUÉS**:
```js
async function getMatchStats(req, res) {
  const { gameId } = req.params;
  const result = await db.readThrough(
    'game_stats',
    { select: 'data', eq: { game_id: gameId }, single: true },
    () => scores365.getGameStats(gameId),
    { onConflict: 'game_id' }
  );
  return res.json(result);
}
```

### 2.3 — Archivos a modificar

| Archivo | Endpoints | Esfuerzo |
|---|---|---|
| `database/db.js` | Añadir `readThrough` | 0.5 h |
| `dashboard/server/controllers/matchController.js` | stats, lineups, predictions, timeline | 1 h |
| `dashboard/server/controllers/standingController.js` | standings, standings/seasons, brackets | 0.5 h |
| `dashboard/server/controllers/statsController.js` | scorers, assists, ratings | 0.5 h |
| `dashboard/server/controllers/infoController.js` | competitions/:id, competitions/:id/seasons | 0.5 h |
| `dashboard/server/controllers/transfersController.js` | competitions/:id/transfers, suggestions | 0.5 h |
| `utils/dbStats.js` | Añadir contador `upsertsFromCacheMiss` | 0.25 h |

### 2.4 — Consideraciones importantes

- **No persistir datos incorrectos**: el fetcher debe devolver la misma forma esperada por la tabla
- **Sobrescritura**: `onConflict` debe coincidir con la PK de la tabla
- **TTL**: considerar no sobrescribir datos frescos con datos más viejos (comparar `updated_at`)
- **Concurrencia**: dos requests simultáneos al mismo endpoint pueden hacer dos upserts. Es aceptable (último gana)

## 3. Tests a añadir

| Archivo | Tipo | Cubre |
|---|---|---|
| `tests/unit/readThrough.test.js` | Unit | readThrough cache miss → write-back, cache hit → skip |
| `tests/integration/cacheWarmup.test.js` | Integration | Tras llamar a un endpoint, DB tiene datos |
| `tests/integration/dbStats.writeback.test.js` | Integration | Contador upsertsFromCacheMiss aumenta |

## 4. Criterio de aceptación

- [ ] 14 endpoints DB_FIRST ahora persisten datos vía `readThrough`
- [ ] Tras warmup (una llamada por endpoint), `scores365` deja de recibir requests del dashboard
- [ ] `upsertsFromCacheMiss` en `/api/football/health` muestra contador > 0
- [ ] `pgCalls` en health no crece significativamente (sigue siendo ~minoría)

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Persistir datos incompletos de 365 | Validar shape antes de upsert; si es null/undefined, no persistir |
| TTL distinto por endpoint | `readThrough` acepta `ttlMs` opcional; si el dato en DB es más reciente que ttl, no llama a 365 |
| Duplicados al hacer upsert con datos parciales | Usar `ON CONFLICT DO UPDATE` con merge de JSONB si aplica |
| Stale data en DB impide refrescar | El fetch a 365 solo ocurre si DB devuelve 0 filas; si la DB tiene datos stale, no se refrescan. Solución: sync jobs siguen siendo el mecanismo de refresco. |
