# Fase 8 — Cobertura de tests críticos

**Estado:** ⏳ Pendiente
**Esfuerzo:** 6-8 h
**Riesgo:** Bajo
**Bloquea deploy:** No
**PR:** `hardening/phase-08-tests`

## Objetivo

Agregar tests para los módulos más críticos de seguridad y arquitectura, y activar coverage thresholds en Jest.

## Cambios

### 8.1 — Tests para `utils/logger.js` (PII redaction)

**Archivo nuevo:** `tests/unit/logger-redaction.test.js`

**Casos a cubrir:**
- Pino redacta `text`, `body`, `message` y `*.text`, `req.body.text`, `update.message.text`.
- Pino redacta `req.headers.authorization`, `req.headers.cookie`.
- Pino redacta env vars por nombre (`TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `DB_PASSWORD`, `SUPABASE_DB_URL`).
- Console shim (fallback) también redacta por key.
- `consoleShim` redacta `data.authorization` correctamente.

**Esfuerzo:** 1 h.

### 8.2 — Tests para `utils/adminAuth.js`

**Archivo nuevo:** `tests/unit/adminAuth.test.js`

**Casos a cubrir:**
- `isAdminEnabled()` retorna `false` si `ADMIN_TOKEN` unset.
- `isAdminEnabled()` retorna `false` si token < 8 chars.
- `isAdminEnabled()` retorna `true` si token >= 8 chars.
- `requireAdmin(req)` retorna `false` si no hay Authorization header.
- `requireAdmin(req)` retorna `false` si Bearer no matchea.
- `requireAdmin(req)` retorna `true` si Bearer matchea.
- `requireAdmin(req)` acepta `admin_token` cookie.
- Comparación es constant-time (verificable midiendo tiempo con muchas comparaciones — flaky test, mejor skip).

**Esfuerzo:** 1 h.

### 8.3 — Tests para `utils/processGuard.js`

**Archivo nuevo:** `tests/unit/processGuard.test.js`

**Casos a cubrir:**
- `installProcessGuard()` registra handlers para `unhandledRejection` y `uncaughtException`.
- `unhandledRejection` no mata el proceso (sólo loguea).
- `uncaughtException` mata el proceso con exit code 1.
- Logger injection funciona (mock).

**Esfuerzo:** 30 min.

### 8.4 — Tests para `utils/jobGuard.js`

**Archivo nuevo:** `tests/unit/jobGuard.test.js`

**Casos a cubrir:**
- `wrap('name', fn)` ejecuta fn si no hay lock.
- `wrap('name', fn)` skip si ya hay lock.
- Lock se libera en `finally` aunque fn lance.
- 100 `Promise.all([wrap('name', fn)])` → fn se ejecuta 1 vez.

**Esfuerzo:** 30 min.

### 8.5 — Tests para `database/db.js:assertIdent/assertSelectList`

**Archivo nuevo:** `tests/unit/db-sql-guards.test.js`

**Casos a cubrir (fuzzing contra SQL injection):**
- `assertIdent('users')` pasa.
- `assertIdent('public.users')` pasa.
- `assertIdent('users; DROP TABLE users;')` lanza.
- `assertIdent("users' OR 1=1--")` lanza.
- `assertIdent('')` lanza.
- `assertIdent('123table')` lanza (no empieza con letra/underscore).
- `assertSelectList('id, name')` pasa.
- `assertSelectList('id, name; DROP')` lanza.
- `assertSelectList('*')` pasa (permitido explícitamente).

**Esfuerzo:** 1 h.

### 8.6 — Tests para `src/infrastructure/container.js`

**Archivo nuevo:** `tests/unit/container.test.js`

**Casos a cubrir:**
- `createContainer(deps)` retorna `{ router, handleCallback }`.
- `router` es instancia de `createRouter()`.
- Cada command está registrado (verificar via `router.dispatch('message', ...)` con mocks).
- Composition root falla ruidosamente si un use case signature cambia.

**Estrategia:** mock todos los `deps` con stubs (`getLiveGamesText: jest.fn()`, etc.) y verificar que las llamadas fluyen.

**Esfuerzo:** 2 h.

### 8.7 — Tests para `admin/server.js`

**Archivo nuevo:** `admin/tests/server.test.js`

**Casos a cubrir:**
- Sin `ADMIN_TOKEN` → 503 en `/api/stats`, `/api/users`, `/api/queries`, `/api/followed-teams`, `/api/queries-by-type`.
- `ADMIN_TOKEN=invalid` + Bearer incorrecto → 401.
- `ADMIN_TOKEN=validtoken123` + Bearer correcto → 200.
- `?limit=999999` clampea a 500 en `/api/queries`.
- `?full=1` devuelve `consulta` completa.
- Sin `?expand=1` NO devuelve `respuesta`.

**Setup de Jest para admin:**
- Crear `admin/jest.config.js`:
```js
module.exports = {
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'node',
  clearMocks: true,
};
```
- Crear `admin/package.json` (si no existe) con `test: "jest"`.

**Esfuerzo:** 2 h.

### 8.8 — Coverage thresholds

**Archivo:** `jest.config.js`

**Cambio:**
```js
module.exports = {
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dashboard/', '/admin/'],
  clearMocks: true,
  collectCoverageFrom: [
    'utils/**/*.js',
    'database/**/*.js',
    'src/**/*.js',
    'services/**/*.js',
    'handlers/**/*.js',
    '!**/node_modules/**',
    '!**/*.test.js',
  ],
  coverageThreshold: {
    global: { branches: 50, functions: 60, lines: 60, statements: 60 },
    './utils/': { branches: 70, functions: 80, lines: 80, statements: 80 },
    './database/': { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
};
```

**Nota:** los thresholds son generosos al inicio. Se ajustan al alza en sprints siguientes.

**Esfuerzo:** 15 min (config) + iteración hasta pasar.

## Tests nuevos (resumen)

| Archivo | Líneas | Cobertura |
|---|---|---|
| `tests/unit/logger-redaction.test.js` | ~80 | PII redaction |
| `tests/unit/adminAuth.test.js` | ~60 | auth constants + flows |
| `tests/unit/processGuard.test.js` | ~50 | crash policy |
| `tests/unit/jobGuard.test.js` | ~50 | race protection |
| `tests/unit/db-sql-guards.test.js` | ~70 | SQL injection guards |
| `tests/unit/container.test.js` | ~120 | composition root |
| `admin/tests/server.test.js` | ~150 | admin endpoints |
| `dashboard/tests/cache.lru.test.ts` | ~60 | LRU eviction |
| `dashboard/tests/http-client.test.ts` | ~50 | URL builder |

## Criterios de aceptación

- [ ] Tests nuevos pasan en CI.
- [ ] Coverage thresholds activos.
- [ ] Coverage de `utils/` >= 80% lines.
- [ ] Coverage de `database/` >= 70% lines.
- [ ] Coverage global >= 60% lines.

## Rollback

Revert del commit. Cambios aditivos.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `tests/unit/logger-redaction.test.js` (nuevo) | ~80 |
| `tests/unit/adminAuth.test.js` (nuevo) | ~60 |
| `tests/unit/processGuard.test.js` (nuevo) | ~50 |
| `tests/unit/jobGuard.test.js` (nuevo) | ~50 |
| `tests/unit/db-sql-guards.test.js` (nuevo) | ~70 |
| `tests/unit/container.test.js` (nuevo) | ~120 |
| `admin/tests/server.test.js` (nuevo) | ~150 |
| `admin/jest.config.js` (nuevo) | ~10 |
| `admin/package.json` (nuevo o extender) | ~10 |
| `jest.config.js` | ~15 líneas (coverage config) |