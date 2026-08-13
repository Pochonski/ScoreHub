# Fase 12 — Migración del legacy pendiente

**Estado:** ⏳ Pendiente
**Esfuerzo:** 4-6 h
**Riesgo:** Medio
**Bloquea deploy:** No
**PR:** `hardening/phase-12-legacy`

## Objetivo

Completar el strangler fig: migrar los casos especiales de `telegramBot.js:73-150` al nuevo router, y reemplazar `console.*` en handlers/services legacy por logger Pino.

## Cambios

### 12.1 — Migrar comandos especiales de `processMessage`

**Archivo:** `telegramBot.js` (líneas 73-150)

**Problema:** `processMessage` tiene hardcoded special cases para `/follow`, `/unfollow`, `/misapuestas`, `/siguiendo` antes de delegar al router. Es el strangler en acción, pero rompe uniformidad.

**Cambio:** crear `src/interface/telegram/commands/follow.js` con:
```js
// src/interface/telegram/commands/follow.js
function registerFollowCommands(router, deps) {
  const { followHandler, messageHandler, nlu, log } = deps;

  router.register('/follow', async (msg) => {
    return followHandler.handleFollow(msg);
  });
  router.register('/unfollow', async (msg) => {
    return followHandler.handleUnfollow(msg);
  });
  router.register('/misapuestas', async (msg) => {
    return followHandler.handleMisApuestas(msg);
  });
  router.register('/siguiendo', async (msg) => {
    return followHandler.handleSiguiendo(msg);
  });
}

module.exports = { registerFollowCommands };
```

Y en `telegramBot.js:73-150`, eliminar los `if (text === '/follow') …` blocks y delegar al router completamente:
```js
async function processMessage(msg) {
  const text = msg.text || '';
  if (text.startsWith('/')) {
    const handled = await router.dispatch('message', msg);
    if (handled) return;
  }
  // NL path
  return messageHandler.process(msg);
}
```

**Riesgo:** los handlers legacy (`followHandler`) tienen side effects (DB writes, file I/O). Hay que mockearlos bien en tests.

**Sub-PRs recomendados:**
- 12.1a: tests para `followHandler` (que actualmente no existen).
- 12.1b: migrar `/follow` y `/unfollow`.
- 12.1c: migrar `/misapuestas` y `/siguiendo`.
- 12.1d: simplificar `processMessage`.

**Esfuerzo total:** 4 h.

### 12.2 — Logger Pino en legacy handlers

**Archivos:** todos los `console.*` en:
- `handlers/followHandler.js`
- `handlers/messageHandler.js`
- `handlers/conversationalHandler.js`
- `handlers/matchHandler.js`
- `handlers/teamHandler.js`
- `handlers/tableHandler.js`
- `handlers/statsHandler.js`
- `handlers/bettingHandler.js`
- `handlers/betImageHandler.js`
- `handlers/mundialista365Handler.js`
- `handlers/mundialistaStatsHandler.js`
- `services/betTrackingEngine.js`
- `services/conversationContext.js:49,143`
- `services/liveGamesPoller.js`
- `services/intentParser.js`
- `services/ocrService.js`
- `services/telegramNotifier.js`

**Cambio:** importar `const log = require('../utils/logger')` y reemplazar:
- `console.log(...)` → `log.info(...)`
- `console.error(...)` → `log.error(...)`
- `console.warn(...)` → `log.warn(...)`

**Estrategia:** búsqueda + reemplazo + revisión manual de cada call site (algunos tienen interpolación compleja que necesita ajuste).

**Esfuerzo:** 2 h.

### 12.3 — `legacy/whatsapp-bot.js` cleanup

**Archivo:** `legacy/whatsapp-bot.js` (líneas 13-17)

**Decisión:** el archivo ya está cuarentenado (return temprano si `ENABLE_WHATSAPP !== 'true'`). Decidir:
- **Opción A:** mantener tal cual, sólo actualizar el comentario para reflejar que el bot nunca va a reactivar WhatsApp (recomendado si la decisión es firme).
- **Opción B:** mover a un repo separado `scorehub-legacy-whatsapp` y eliminar del monorepo.
- **Opción C:** eliminar del monorepo completamente.

**Decisión recomendada:** Opción A. El código está documentado y aislado; removerlo no aporta mucho.

**Cambio:** agregar al README del legacy:
```md
## Estado
Cuarentenado desde Fase 7 (Jul 2025). Las dependencias (`whatsapp-web.js`, `qrcode-terminal`) se removieron de `package.json` para reducir superficie de ataque y bundle size. Para reactivar:
1. Reinstalar deps: `npm install whatsapp-web.js qrcode-terminal`.
2. Setear `ENABLE_WHATSAPP=true`.
3. Verificar que el host tiene Chrome/Chromium instalado.
```

**Esfuerzo:** 30 min.

## Tests nuevos

- `tests/telegramBot.followCommands.test.js` (preview de Fase 12.1):
  - `/follow` registrado en router.
  - `/unfollow` registrado.
  - `/misapuestas` registrado.
  - `/siguiendo` registrado.
  - `processMessage` ya no tiene if/else hardcodeados.
- Smoke: ejecutar `node telegramBot.js` con mocks y verificar que cada comando fluye por el router.

## Criterios de aceptación

- [ ] `src/interface/telegram/commands/follow.js` creado.
- [ ] `processMessage` simplificado — sin if/else hardcodeados para follow/unfollow/etc.
- [ ] Cero `console.*` en handlers/* y services/* (excepto donde intencional).
- [ ] `legacy/whatsapp-bot.js` documentado como permanente-cuarentenado.
- [ ] Tests pasan.

## Rollback

Revert del commit. Riesgo medio — los handlers legacy tienen muchos call sites.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `src/interface/telegram/commands/follow.js` (nuevo) | ~40 |
| `telegramBot.js` | ~30 líneas menos (cases hardcoded) |
| `handlers/*.js` | ~50 líneas (console → log) |
| `services/*.js` | ~30 líneas (console → log) |
| `legacy/README.md` | ~10 líneas (status update) |
| Tests nuevos | ~100 |