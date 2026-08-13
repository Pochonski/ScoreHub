# Fase 0 — Seguridad crítica

**Estado:** ⏳ Pendiente
**Esfuerzo:** 3-4 h
**Riesgo:** Bajo
**Bloquea deploy:** **Sí**
**PR:** `hardening/phase-00-critical-security`

## Objetivo

Cerrar las dos vulnerabilidades activas con exploit concreto identificadas en la auditoría Q3 2026:

1. **XSS en admin** — `admin/public/index.html` interpola texto user-controlled de `historial_consultas` directamente en `innerHTML`/`insertAdjacentHTML`/`onclick` (líneas 412, 435-451, 481-498, 534-553, 595-604, 616-623).
2. **Webhook sin firma** — `src/interface/http/server.js:257-269` no valida `X-Telegram-Bot-Api-Secret-Token`, permitiendo a un atacante con la URL del webhook inyectar updates arbitrarias.

## Cambios

### 0.1 — Sanitización XSS en admin

**Archivo:** `admin/public/index.html`

**Pasos:**
1. Agregar helper `escapeHtml(s)` al inicio del bloque `<script>` (línea ~285).
2. Reemplazar todas las interpolaciones `${campo}` por `${escapeHtml(campo)}` en las 11 ocurrencias listadas en AUDIT-2026-Q3.md §5.11.
3. Reemplazar `onclick="toggleResponse(this, '${q.id}')"` (líneas 442, 488) por `addEventListener('click', …)` con `data-id` attribute. Esto elimina el templated `'${q.id}'` que es un vector de escape incluso si el ID se mantiene entero.
4. Validar que `q.id` se mantiene como `Number.isInteger(Number(q.id))` antes de cualquier composición. Sanity check JS.

**Helper sugerido (top del `<script>`):**
```js
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
```

**Verificación:**
- Test manual: enviar `<img src=x onerror="alert(1)">` desde un usuario de Telegram al bot; el bot lo guarda en `historial_consultas.consulta` (ver `telegramBot.js:62-64`); abrir el panel admin → el texto debe aparecer literalmente, sin ejecutar el script.
- Smoke test del panel: `curl http://localhost:3001/admin/api/queries -H "Authorization: Bearer …"` debe seguir devolviendo JSON válido.

### 0.2 — Validación de webhook secret

**Archivo:** `src/interface/http/server.js`

**Cambio:** antes del bloque `JSON.parse(body)` en el handler `/webhook` (líneas 257-269), agregar:

```js
} else if (url === WEBHOOK_PATH && req.method === 'POST') {
  const expected = process.env.WEBHOOK_SECRET;
  if (expected) {
    const provided = req.headers['x-telegram-bot-api-secret-token'];
    if (!provided || provided !== expected) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('unauthorized');
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Fail-safe: en producción sin WEBHOOK_SECRET, endpoint cerrado
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('webhook disabled');
    return;
  }
  let body = '';
  // ... resto igual
```

**Archivos adicionales:**
- `.env.example`: agregar bloque con `WEBHOOK_SECRET=` y comentario explicando cómo generarlo.
- `docs/env-vars.md`: documentar la variable y el flow de `setWebhook`.

**Setup del secret en Telegram:**
1. Generar secret: `openssl rand -hex 32`.
2. Pasar a `setWebhook` con `secret_token`: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>&secret_token=<SECRET>`.
3. Configurar `WEBHOOK_SECRET=<SECRET>` en env del bot.

**Verificación:**
- Test 1: `curl -X POST http://localhost:PORT/webhook -d '{"update_id":1}'` → debe dar 401 (con `WEBHOOK_SECRET` seteado) o 503 (en prod sin secret).
- Test 2: `curl -X POST http://localhost:PORT/webhook -H "X-Telegram-Bot-Api-Secret-Token: $WEBHOOK_SECRET" -d '…'` → debe seguir procesando.
- Test 3: el bot sigue funcionando en long-polling (el path `/webhook` solo se activa cuando llega POST, no afecta `getUpdates`).

## Tests nuevos

No requiere tests automatizados nuevos — son cambios que se verifican manualmente. Los criterios de aceptación sirven como checklist.

## Criterios de aceptación

- [ ] Helper `escapeHtml` agregado a `admin/public/index.html`.
- [ ] Cero interpolaciones `${campo_usuario}` sin escape en `admin/public/index.html`.
- [ ] Cero `onclick="…${variable}…"` en `admin/public/index.html`; reemplazados por `addEventListener`.
- [ ] `WEBHOOK_SECRET` validado en `src/interface/http/server.js`.
- [ ] Fail-safe: en `NODE_ENV=production` sin `WEBHOOK_SECRET`, el endpoint devuelve 503.
- [ ] `.env.example` documenta la variable.
- [ ] `docs/env-vars.md` actualizado.
- [ ] PR pasa CI.

## Rollback

Revert del commit. Sin migraciones ni schema changes.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `admin/public/index.html` | ~30 líneas (11 interpolaciones + helper + 2 event listeners) |
| `src/interface/http/server.js` | ~15 líneas (guard + 503 fail-safe) |
| `.env.example` | +5 líneas (bloque `WEBHOOK_SECRET`) |
| `docs/env-vars.md` | +20 líneas (sección dedicada) |
| `docs/refactor-plans/audit-master-plan.md` | marcar Fase 0 como ✅ Cerrado |