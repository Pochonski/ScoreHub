# Fase 5 — Limpieza de anti-patterns

**Estado:** ⏳ Pendiente
**Esfuerzo:** 3-4 h
**Riesgo:** Bajo
**Bloquea deploy:** No
**PR:** `hardening/phase-05-antipatterns`

## Objetivo

Eliminar anti-patterns identificados en la auditoría:
- `flushSync` no conectado a SIGTERM (pérdida de contexto).
- `syncGames` alias no-op.
- `syncService.js` re-exports con spread (colisión silenciosa de nombres).
- Dos mutexes `isRunning` para la misma idea.
- SQL inline en `src/interface/http/server.js`.

## Cambios

### 5.1 — `flushSync` en SIGTERM/SIGINT

**Archivos:**
- `telegramBot.js` — agregar al final (antes del entry guard):
  ```js
  const conversationContext = require('./services/conversationContext');
  function gracefulShutdown(signal) {
    log.info({ signal }, 'Shutdown signal received, flushing context');
    try {
      conversationContext.flushSync();
    } catch (e) {
      log.error({ err: e }, 'flushSync failed');
    }
    process.exit(0);
  }
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  ```
- Idem para `sync.js`.

**Esfuerzo:** 30 min.

### 5.2 — Eliminar `syncGames` no-op

**Archivos:**
- `src/application/sync/games.js` (líneas 14-30) — el alias está conservado para "compatibilidad con el scheduler y tests" pero ensucia los logs y es confuso.
- `src/application/sync/syncService.js` (línea 32) — comentar la llamada.

**Cambio:**
- En `games.js`: convertir `syncGames()` en función real que delega a `syncFixtures` + `syncGamesResults`. Si la lógica anterior era costosa y se deshabilitó por performance, documentar la razón y dejar `syncGames` como alias explícito:
  ```js
  /**
   * Alias de syncFixtures + syncGamesResults.
   * Mantenido por compatibilidad con tests legacy.
   * @deprecated Usar syncFixtures() + syncGamesResults() directamente.
   */
  async function syncGames() {
    log.warn('syncGames() is deprecated, use syncFixtures() + syncGamesResults()');
    return { ok: 0, skipped: true, reason: 'deprecated alias' };
  }
  ```
- En `syncService.syncAll()` (línea 32): comentar la línea con razón.

**Esfuerzo:** 15 min.

### 5.3 — `syncService.js` re-exports explícitos

**Archivo:** `src/application/sync/syncService.js` (líneas 62-72)

**Cambio:** reemplazar spread por named exports:
```js
// Antes:
module.exports = { syncAll, syncLiveGames, ...games, ...standings, ...content, ...trendsOdds, ...details, ...catalog, ...athletes, ...transfers, ...betSelections };

// Después:
const syncJobs = {
  syncAll,
  syncLiveGames: games.syncLiveGames,
  syncFixtures: games.syncFixtures,
  syncGamesResults: games.syncGamesResults,
  syncStandings: standings.syncStandings,
  syncStandingsWithSeasons: standings.syncStandingsWithSeasons,
  syncTrends: content.syncTrends,
  syncPredictions: content.syncPredictions,
  syncNews: content.syncNews,
  syncTrendsOdds: trendsOdds.syncTrendsOdds,
  syncGameDetails: details.syncGameDetails,
  syncCatalog: catalog.syncCatalog,
  syncAthletes: athletes.syncAthletes,
  syncTransfers: transfers.syncTransfers,
  syncBetSelections: betSelections.syncBetSelections,
};
module.exports = syncJobs;
```

**Beneficio:** si dos jobs definen el mismo nombre, el conflicto es detectable por inspección o por tests.

**Esfuerzo:** 30 min.

### 5.4 — Unificar `isRunning`

**Archivos:**
- `services/liveGamesPoller.js` (líneas 283-298) — tiene su propio mutex `isRunning`.
- `utils/jobGuard.js` — mutex global con `wrap(jobName, fn)`.

**Cambio:** en `liveGamesPoller.js`, eliminar el boolean local y usar `jobGuard.wrap`:
```js
// Antes:
let isRunning = false;
async function tick() {
  if (isRunning) return;
  isRunning = true;
  try { /* ... */ } finally { isRunning = false; }
}

// Después:
const jobGuard = require('../utils/jobGuard');
async function tick() {
  return jobGuard.wrap('liveGamesPoller', async () => {
    /* ... */
  });
}
```

**Esfuerzo:** 1 h.

### 5.5 — Extraer SQL inline del handler HTTP

**Archivos:**
- Nuevo: `src/interface/http/adminRepository.js`.
- `src/interface/http/server.js` (líneas 113-198) — reemplazar el switch SQL inline por llamadas al repository.

**Diseño:**
```js
// adminRepository.js
const { pool } = require('../../../database/connection');

async function countUsers() {
  const r = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios');
  return r.rows[0].total;
}

async function getRecentUsers(limit = 50) {
  const r = await pool.query(
    'SELECT id, alias, fecha_registro FROM usuarios ORDER BY fecha_registro DESC LIMIT $1',
    [Math.min(500, Math.max(1, limit))]
  );
  return r.rows;
}

// ... etc para cada query del switch

module.exports = {
  countUsers,
  getRecentUsers,
  // ...
};
```

**Beneficio:** el switch del handler queda como puro routing, y las queries son testables individualmente.

**Esfuerzo:** 3 h.

## Tests nuevos

- `tests/unit/syncService-exports.test.js`:
  - Verifica que `syncService.syncLiveGames`, `syncFixtures`, etc. existen y son funciones.
  - Si dos jobs definen el mismo nombre (regresión), el test detecta el conflicto.
- `tests/unit/jobGuard.test.js`:
  - 100 `Promise.all([jobGuard.wrap('test', fn)])` → fn se ejecuta 1 vez.
  - Lock se libera en `finally` aunque fn lance.

## Criterios de aceptación

- [ ] `flushSync()` se llama en SIGTERM/SIGINT en ambos entry points.
- [ ] `syncGames()` marcado como deprecated con log de warning.
- [ ] `syncService` exports explícitos (sin spread).
- [ ] `liveGamesPoller` usa `jobGuard.wrap` (sin boolean local).
- [ ] SQL del handler HTTP extraído a `adminRepository.js`.
- [ ] Tests nuevos pasan.

## Rollback

Revert del commit. Cambios aditivos.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `telegramBot.js` | ~15 líneas (graceful shutdown) |
| `sync.js` | ~10 líneas |
| `src/application/sync/games.js` | ~5 líneas (deprecation) |
| `src/application/sync/syncService.js` | ~20 líneas (named exports) |
| `services/liveGamesPoller.js` | ~10 líneas (jobGuard.wrap) |
| `src/interface/http/server.js` | ~80 líneas menos (repository calls) |
| `src/interface/http/adminRepository.js` (nuevo) | ~150 líneas |
| Tests nuevos | ~80 líneas |