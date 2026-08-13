# Fase 9 — Admin panel profesional

**Estado:** ⏳ Pendiente
**Esfuerzo:** 4 h
**Riesgo:** Bajo
**Bloquea deploy:** No
**PR:** `hardening/phase-09-admin`

## Objetivo

Endurecer el panel admin con audit log, validación de longitud mínima de token, y refinamientos de seguridad.

## Cambios

### 9.1 — Audit log

**Archivos:**
- Nuevo: `utils/adminAudit.js` (logger Pino separado).
- `admin/server.js` — middleware que registra cada request.

**Diseño:**
```js
// utils/adminAudit.js
const pino = require('pino');
const path = require('path');

const audit = pino({
  level: 'info',
  base: { component: 'admin-audit' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'token'],
    censor: '[REDACTED]',
  },
  // File transport en producción
  ...(process.env.ADMIN_AUDIT_FILE
    ? pino.transport({ target: 'pino/file', options: { destination: process.env.ADMIN_AUDIT_FILE } })
    : {}),
});

module.exports = audit;
```

```js
// admin/server.js (después del auth gate)
const audit = require('../utils/adminAudit');

app.use((req, res, next) => {
  if (!req.url.startsWith('/api/')) return next(); // sólo API, no static
  const start = Date.now();
  res.on('finish', () => {
    audit.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
      tokenPrefix: (req.headers.authorization || '').slice(0, 16),
    }, 'admin request');
  });
  next();
});
```

**Esfuerzo:** 1 h.

### 9.2 — `ADMIN_TOKEN` mínimo 32 chars

**Archivo:** `utils/adminAuth.js` (línea 23)

**Cambio:**
```js
function isAdminEnabled() {
  const t = process.env.ADMIN_TOKEN;
  if (!t || t.length < 32) return false;
  return true;
}
```

**Documentación:** en `.env.example:77` actualizar:
```
# ⚠️ Mínimo 32 caracteres (64 hex recomendado: `openssl rand -hex 32`).
# Sin token válido, el panel queda deshabilitado (503).
ADMIN_TOKEN=
```

**Verificación:** tests existentes en `tests/http.server.test.js` deben seguir pasando — actualizar si mockean `ADMIN_TOKEN` con valor corto.

**Esfuerzo:** 15 min.

### 9.3 — Frontend admin refactor (opcional)

**Decisión:** migrar el vanilla JS de `admin/public/index.html` (639 líneas) a un módulo separado `admin/public/app.js` extraído. Reduce XSS surface y mejora mantenibilidad sin React.

**Cambio:**
- Mover todo el `<script>…</script>` de `index.html` a `app.js` con `<script src="app.js" defer></script>`.
- Aprovechar para agregar `escapeHtml` (ya en Fase 0) y refactorizar `innerHTML` a `textContent` donde sea posible.

**Esfuerzo:** 2 h.

### 9.4 — CSP en admin (post-Fase 1)

**Archivo:** `admin/public/index.html`

**Cambio:** ahora que Helmet está activo (Fase 1.3), configurar CSP permisivo para CDN:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net https://unpkg.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self' data:;
  connect-src 'self';
">
```

**Esfuerzo:** 15 min.

## Tests nuevos

- `admin/tests/audit.test.js`:
  - Middleware emite log estructurado con method/url/status/duration.
  - Token authorization se redacta.
  - Logs sólo para `/api/*` (no para `/` ni `static/*`).

## Criterios de aceptación

- [ ] `utils/adminAudit.js` creado.
- [ ] Middleware audit en `admin/server.js`.
- [ ] `ADMIN_TOKEN` >= 32 chars.
- [ ] (Opcional) `app.js` extraído de `index.html`.
- [ ] CSP configurado en admin.
- [ ] Tests pasan.

## Rollback

Revert del commit. Cambios aditivos.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `utils/adminAudit.js` (nuevo) | ~30 |
| `admin/server.js` | ~20 líneas (middleware + length check) |
| `utils/adminAuth.js` | ~3 líneas (32 chars) |
| `.env.example` | ~3 líneas (comment update) |
| `admin/public/index.html` | opcional, refactor a `app.js` |
| `admin/tests/audit.test.js` (nuevo) | ~50 |