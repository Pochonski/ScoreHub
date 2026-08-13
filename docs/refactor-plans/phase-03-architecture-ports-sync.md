# Fase 3 — Arquitectura: ports tipados + sync gateado

**Estado:** ⏳ Pendiente
**Esfuerzo:** 6-8 h
**Riesgo:** Medio
**Bloquea deploy:** No
**PR:** `hardening/phase-03-architecture`

## Objetivo

- Convertir los ports vacíos (`module.exports = {}`) en factories tipadas con duck-type enforcement.
- Eliminar el bypass del gateway nuevo en el sync layer.
- Tipar el "wide bag" del container.

## Cambios

### 3.1 — `scoresGateway.js` port como factory tipada

**Archivo:** `src/domain/ports/scoresGateway.js`

**Problema actual:** `module.exports = {}` con sólo JSDoc. Cualquier adapter pasa sin chequeo.

**Cambio:**
```js
const REQUIRED_METHODS = [
  'getLiveGamesText',
  'getFixtureText',
  'getMatchDetailText',
  'getTipPartidoText',
  'getH2HText',
  'getPreviaText',
  'getPrediccionesText',
  'getLineupsText',
  'getStatsVivoText',
  'getOutrightsText',
  'getGameSuggestionsText',
  'getGameTrendsText',
  'getGameOddsText',
  'findGame',
  'searchFixture',
];

function createScoresGateway(deps) {
  if (!deps) throw new Error('createScoresGateway: deps required');
  const adapter = {
    getLiveGamesText: () => { throw new Error('not implemented'); },
    getFixtureText: () => { throw new Error('not implemented'); },
    // ... stub defaults
    ...deps,
  };
  return new Proxy(adapter, {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop) && typeof target[prop] !== 'function') {
        throw new Error(`scoresGateway.${prop} is not implemented`);
      }
      return target[prop];
    },
  });
}

module.exports = { createScoresGateway, REQUIRED_METHODS };
```

**Verificación:** cualquier adapter incompleto falla ruidosamente al primer uso en vez de propagar `undefined` hasta el comando Telegram.

### 3.2 — `contentGateway.js` port como factory tipada

**Archivo:** `src/domain/ports/contentGateway.js`

**Cambio:** análogo al 3.1 con los métodos:
- `getNoticias`
- `getEquipoIdeal`
- `getBracket`
- `getHistorial`
- `getHistorialByYear`
- `getHistorialByTeam`
- `getGoleadores`

### 3.3 — Sync layer usar el gateway nuevo

**Archivos:**
- `src/application/sync/context.js` (línea 11) — actualmente `require('../../../services/scores365Service')`.
- `src/interface/scheduler/scheduler.js` — punto de inyección.

**Cambio en 2 pasos:**

**Paso A — Inyección en scheduler:**
```js
// src/interface/scheduler/scheduler.js
const { createScoresGateway } = require('../../domain/ports/scoresGateway');
const scores365 = require('../../../services/scores365Service');
const matchSearch = require('../../../services/matchSearch');
const mundialista365 = require('../../../handlers/mundialista365Handler');
const scores365Raw = require('../../../handlers/scores365');

const scoresGateway = createScoresGateway({
  getLiveGamesText: () => /* delegate */,
  getFixtureText: () => /* delegate */,
  // ... mapear todos los métodos al gateway legacy
});
```

**Paso B — Pasar `scoresGateway` a cada sync use case:**
```js
// src/application/sync/context.js
function createContext({ scoresGateway, scores365Service, log }) {
  return { scoresGateway, scores365Service, log };
}
```

Y migrar gradualmente los sync use cases (`games.js`, `standings.js`, `trendsOdds.js`, etc.) para que usen `ctx.scoresGateway` en vez de `ctx.scores365Service` directo.

**Sub-PRs recomendados:**
- 3.3a: `syncService.js` + `games.js`
- 3.3b: `standings.js`
- 3.3c: `trendsOdds.js`
- 3.3d: resto

**Esfuerzo total:** 4 h (1 h por sub-PR).

### 3.4 — Tipar el "wide bag" del container

**Archivo:** `src/infrastructure/container.js` (líneas 33-38)

**Cambio:** agregar typedef JSDoc:
```js
/**
 * @typedef {Object} ContainerDeps
 * @property {ReturnType<typeof import('./scores365/scoresGateway').createScoresGatewayAdapter>} scoresGateway
 * @property {ReturnType<typeof import('./content/contentGateway').createContentGatewayAdapter>} contentGateway
 * @property {ReturnType<typeof import('./nlu/messageHandlerGateway').createMessageHandlerGateway>} nlu
 * @property {ReturnType<typeof require('../../../services/scores365Service')>} scores365Service
 * @property {...} matchSearch
 * @property {...} mundialista365
 * @property {...} mundialistaStats
 * @property {...} cache
 * @property {...} matchHandler
 * @property {...} images
 * @property {...} userStorage
 * @property {...} notifier
 * @property {...} log
 */

/**
 * @param {ContainerDeps} deps
 */
function createContainer(deps) { /* ... */ }
```

**Esfuerzo:** 1 h.

## Tests nuevos

- `tests/unit/scoresGateway-port.test.js`:
  - Adapter completo pasa el Proxy sin lanzar.
  - Adapter sin un método required lanza `not implemented` al acceder.
  - Adapter con método extra no rompe.
- `tests/unit/contentGateway-port.test.js`: análogo.
- `tests/unit/container.test.js`:
  - `createContainer(deps)` retorna `{ router, handleCallback }`.
  - Cada command está registrado (verificar con `router.commands` introspection).

## Criterios de aceptación

- [ ] `createScoresGateway` y `createContentGateway` exportados desde sus ports.
- [ ] Adapters actualizados para usar las factories (sin breaking change en runtime).
- [ ] Proxy enforcement activo: cualquier adapter incompleto falla ruidosamente.
- [ ] Sync layer (al menos `games.js` + `standings.js`) usa `ctx.scoresGateway` en vez de `ctx.scores365Service` directo.
- [ ] `ContainerDeps` typedef agregado.
- [ ] Tests nuevos pasan.

## Rollback

Revert del commit. Los ports siguen siendo compatibles (default methods lanzan error, no rompen runtime).

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `src/domain/ports/scoresGateway.js` | ~40 líneas (factory + Proxy) |
| `src/domain/ports/contentGateway.js` | ~30 líneas |
| `src/infrastructure/scores365/scoresGateway.js` | ~10 líneas (uso de factory) |
| `src/infrastructure/content/contentGateway.js` | ~10 líneas |
| `src/application/sync/context.js` | ~10 líneas (recibir gateway) |
| `src/interface/scheduler/scheduler.js` | ~30 líneas (wiring) |
| `src/application/sync/games.js`, `standings.js`, `trendsOdds.js` | ~30 líneas (c/u, gradual) |
| `src/infrastructure/container.js` | ~20 líneas (typedef) |
| `tests/unit/scoresGateway-port.test.js` (nuevo) | ~50 líneas |
| `tests/unit/contentGateway-port.test.js` (nuevo) | ~40 líneas |
| `tests/unit/container.test.js` (nuevo) | ~60 líneas |