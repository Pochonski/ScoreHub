# Fase 4 — Consolidación de config + logger

**Estado:** ⏳ Pendiente
**Esfuerzo:** 4-5 h
**Riesgo:** Medio
**Bloquea deploy:** No
**PR:** `hardening/phase-04-config-logger`

## Objetivo

- Centralizar lectura de env vars en un único módulo.
- Eliminar las 16 llamadas dispersas a `dotenv.config()`.
- Reemplazar `console.*` en `src/interface/` por logger Pino.

## Cambios

### 4.1 — Módulo único de config

**Archivos:**
- Nuevo: `src/infrastructure/config.js` (extender el actual — sólo lee 3 vars).
- Marcar deprecated: `services/config.js` (línea 1-3) — agregar `console.warn('services/config.js is deprecated, use src/infrastructure/config.js')` y mantener 1 release para retrocompat.

**Diseño del config unificado:**

```js
// src/infrastructure/config.js
const path = require('path');
const dotenv = require('dotenv');

// Cargar .env una sola vez desde el entry point
function loadEnv() {
  if (process.env.__DOTENV_LOADED__) return;
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  process.env.__DOTENV_LOADED__ = '1';
}

const cache = new Map();
function get(key, defaultValue) {
  loadEnv();
  if (!cache.has(key)) {
    cache.set(key, process.env[key] ?? defaultValue);
  }
  return cache.get(key);
}

function getInt(key, defaultValue) {
  const v = get(key, defaultValue);
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Config: ${key} must be integer, got ${v}`);
  }
  return n;
}

function getBool(key, defaultValue) {
  const v = get(key, defaultValue);
  return v === 'true' || v === '1';
}

module.exports = {
  loadEnv,
  get, getInt, getBool,
  // Helpers tipados
  telegramToken: () => get('TELEGRAM_BOT_TOKEN'),
  primaryCompetitionId: () => getInt('PRIMARY_COMPETITION_ID', 5930),
  primarySeason: () => getInt('PRIMARY_SEASON', 25),
  logLevel: () => get('LOG_LEVEL', 'info'),
  webhookSecret: () => get('WEBHOOK_SECRET'),
  adminToken: () => get('ADMIN_TOKEN'),
  corsOrigins: () => get('CORS_ORIGINS', '').split(',').map(s => s.trim()).filter(Boolean),
  enableLiveNotifier: () => getBool('ENABLE_LIVE_NOTIFIER', false),
  port: () => getInt('PORT', 8080),
  adminPort: () => getInt('ADMIN_PORT', 3001),
  dashboardPort: () => getInt('DASHBOARD_PORT', 3002),
};
```

**Migración por módulo:**
- `services/config.js` línea 1 → `const config = require('../src/infrastructure/config'); const PRIMARY_COMPETITION_ID = config.primaryCompetitionId();`
- `services/scores365Service.js:11-15` → leer via `config.get('SCORES365_TIMEZONE')` etc.
- `services/liveGamesPoller.js:10` → `config.getInt('SCORES365_POLL_MS', 25000)`.
- `database/connection.js:31-38` → `config.getInt('DB_POOL_MAX', 1)` etc.
- `database/connection.js:85` → `config.getInt('DB_QUERY_RETRIES', 3)`.
- `src/application/sync/athletes.js:65` → `config.getInt('ATHLETE_STALE_AFTER_MS', 86400000)`.
- `dashboard/server/utils/competition.js:19-20` → idem.
- Todos los `process.env.X` en `src/` → `config.get('X')`.

**Eliminar `dotenv.config()` de:**
`telegramBot.js:2`, `sync.js:3`, `services/scores365Service.js:1`, `services/geminiService.js:2`, `services/intentParser.js:1`, `handlers/followHandler.js:1`, `handlers/messageHandler.js:2`, `handlers/conversationalHandler.js:1`, `handlers/mundialista365Handler.js:1`, `handlers/mundialistaStatsHandler.js:1`, `database/connection.js:1`, `src/interface/scheduler/scheduler.js:1`, `src/application/sync/context.js:10`, `src/infrastructure/config.js:13`.

Quedan sólo 2 llamadas: `telegramBot.js` y `sync.js` (entry points), que llaman `config.loadEnv()` al inicio.

**Esfuerzo:** 3 h.

### 4.2 — Logger Pino en `src/interface/`

**Archivos:** todos los `console.*` en:
- `src/interface/telegram/lifecycle.js:84,94,97,111`
- `src/interface/telegram/client.js:81,108,136,157`
- `src/interface/http/server.js:95,203,229,265,267`
- `src/interface/telegram/callbacks.js:36,55`
- `src/interface/telegram/commands/matchData.js:21`
- `src/interface/telegram/commands/players.js:48,104,140,157`

**Cambio:** importar `const log = require('../../../utils/logger')` y reemplazar:
- `console.log(...)` → `log.info(...)`
- `console.error(...)` → `log.error(...)`
- `console.warn(...)` → `log.warn(...)`

**Esfuerzo:** 1 h (búsqueda + reemplazo + verificación de imports).

### 4.3 — Logger Pino en legacy (opcional, puede ser Fase 12)

**Archivos:** todos los `console.*` en `handlers/*`, `services/betTrackingEngine.js`, `services/conversationContext.js:49,143`.

**Decisión:** diferir a Fase 12 (legacy migration) para mantener este PR acotado.

**Esfuerzo:** 4 h (separado).

## Tests nuevos

- `tests/unit/config.test.js`:
  - `get('KEY', default)` retorna default si env no está seteado.
  - `getInt` lanza si valor no es entero.
  - `loadEnv()` es idempotente (segunda llamada no-op).
  - Helpers tipados retornan valores correctos.
- Smoke: después del refactor, `npm run start:telegram` y `node sync.js` arrancan sin leer env vars fallando.

## Criterios de aceptación

- [ ] `src/infrastructure/config.js` exporta `loadEnv`, `get`, `getInt`, `getBool`, y helpers tipados.
- [ ] Cero `process.env.X` en `src/` (excepto en `config.js`).
- [ ] Cero `dotenv.config()` excepto en `telegramBot.js` y `sync.js`.
- [ ] Cero `console.*` en `src/interface/`.
- [ ] `services/config.js` marcado como deprecated (mantiene retrocompat 1 release).
- [ ] Tests nuevos pasan.

## Rollback

Revert del commit. Cambios aditivos — los helpers default permiten revertir módulo por módulo.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `src/infrastructure/config.js` (extender) | ~60 líneas (nuevo módulo) |
| `services/config.js` (deprecate) | ~3 líneas (warning) |
| `services/scores365Service.js` | ~10 líneas |
| `services/liveGamesPoller.js` | ~3 líneas |
| `database/connection.js` | ~10 líneas |
| `src/application/sync/athletes.js` | ~3 líneas |
| `dashboard/server/utils/competition.js` | ~5 líneas |
| `src/interface/telegram/{client,lifecycle,callbacks,commands/*}.js` | ~30 líneas (sustituciones) |
| `src/interface/http/server.js` | ~10 líneas |
| Tests nuevos | ~80 líneas |