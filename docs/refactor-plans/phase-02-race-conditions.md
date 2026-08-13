# Fase 2 — Race conditions y correctness

**Estado:** ⏳ Pendiente
**Esfuerzo:** 2-3 h
**Riesgo:** Bajo
**Bloquea deploy:** Recomendado
**PR:** `hardening/phase-02-race-conditions`

## Objetivo

Cerrar el race condition del cache `readThrough` (Fase 8.4) y eliminar el CORS hardcodeado en producción.

## Cambios

### 2.1 — Lock per-key en `readThrough`

**Archivo:** `database/db.js` (líneas 451-511)

**Problema:** en cache miss, dos requests concurrentes pueden invocar `fetcher()` y hacer dos `upsert()` raceantes.

**Solución:** introducir Map de in-flight Promises por key, similar al patrón de `jobGuard`:
```js
const inFlight = new Map();

async function readThrough(key, ttlMs, fetcher) {
  const cached = await getCached(key);
  if (cached && !isStale(cached, ttlMs)) {
    return { source: 'db', data: cached.data };
  }
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }
  const promise = (async () => {
    try {
      const fresh = await fetcher();
      await upsert(key, fresh);
      return { source: '365+writeback', data: fresh };
    } catch (err) {
      // Si fetcher falla, devolvemos el valor stale si lo teníamos
      if (cached) return { source: 'db-stale', data: cached.data };
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}
```

**Notas:**
- El `try/finally` garantiza que el lock se libere aunque el fetcher explote.
- Si dos requests llegan al mismo tiempo, el segundo espera la promesa del primero (de-dup).
- Si el primer fetcher falla, el segundo reintenta (no se cachea el error).
- Si había valor stale, se devuelve como fallback graceful.

**Esfuerzo:** 1 h.

### 2.2 — CORS por env, sin default hardcodeado

**Archivo:** `dashboard/server/index.js` (líneas 16-18)

**Cambio:** eliminar el array hardcodeado de producción. Si `CORS_ORIGINS` no está seteado, sólo permitir `http://localhost:5173` (desarrollo):
```js
const whitelist = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:5173'];
```

Y agregar al `.env.example` (línea 80) un comentario explícito:
```
# ⚠️ En producción, DEBE estar seteado con el dominio del dashboard.
# Formato: https://app1.example.com,https://app2.example.com
CORS_ORIGINS=
```

**Esfuerzo:** 10 min.

### 2.3 — Validar `new Date(updated_at)` en stale check

**Archivo:** `database/db.js` línea 471

**Problema:** si `updated_at` es `null` o mal formado, `getTime()` devuelve `NaN`, y `NaN > ttlMs` es `false` → stale data tratada como fresh.

**Cambio:**
```js
function isStale(cached, ttlMs) {
  if (!cached || !cached.updated_at) return true;
  const t = new Date(cached.updated_at).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ttlMs;
}
```

**Esfuerzo:** 15 min.

## Tests nuevos

- `tests/unit/readThrough.test.js` (extender el existente):
  - Test de concurrencia: 10 `Promise.all([readThrough(key)])` → exactamente 1 llamada a `fetcher`, 1 `upsert`, 9 deduplicados.
  - Test de fallback stale: `fetcher()` falla → segunda request devuelve stale.
  - Test de retry tras error: `fetcher()` falla la primera vez, éxito la segunda.

- `tests/integration/cors.test.js`:
  - Sin `CORS_ORIGINS` → `Origin: http://localhost:5173` → 200.
  - Sin `CORS_ORIGINS` → `Origin: https://scorehub-pocho.vercel.app` → bloqueado.
  - Con `CORS_ORIGINS=https://app.com` → `Origin: https://app.com` → 200.

## Criterios de aceptación

- [ ] `inFlight` Map agregado en `database/db.js`.
- [ ] CORS default sin dominios de producción.
- [ ] `new Date()` validation en stale check.
- [ ] Test de concurrencia de `readThrough` pasa con 10 requests paralelos.
- [ ] CI verde.

## Rollback

Revert del commit. Cambios aditivos.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `database/db.js` | ~30 líneas (inFlight + helper `isStale`) |
| `dashboard/server/index.js` | ~5 líneas (default de whitelist) |
| `.env.example` | ~3 líneas (comentario CORS) |
| `tests/unit/readThrough.test.js` | ~50 líneas (tests de concurrencia) |
| `tests/integration/cors.test.js` (nuevo) | ~40 líneas |