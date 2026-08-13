# Fase 1 — Hardening de seguridad media

**Estado:** ⏳ Pendiente
**Esfuerzo:** 4-6 h
**Riesgo:** Bajo
**Bloquea deploy:** **Sí**
**PR:** `hardening/phase-01-security-hardening`

## Objetivo

Cerrar el resto de superficies de seguridad identificadas en la auditoría: SQL templated residual, DoS por `?limit=`, falta de `helmet` y rate limit en admin y bot HTTP, SRI ausente en CDN, LIKE wildcards sin escapar, y PII expuesto en `/api/queries`.

## Cambios

### 1.1 — `teamController.js:99` — PostgREST `or` templated

**Archivo:** `dashboard/server/controllers/teamController.js` (líneas 97-117)

**Cambio:** la línea 99 contiene:
```js
or: `(home_competitor_id.eq.${tid},away_competitor_id.eq.${tid})`,
```

Aunque `tid = Number(id)` aguas arriba (línea 83) protege contra injection, es un string templated frágil. **Refactor recomendado:** reemplazar por SQL parametrizado nativo:

```js
const result = await db.execAdvanced(
  `SELECT * FROM games
   WHERE (home_competitor_id = $1 OR away_competitor_id = $1)
     AND competition_id = $2
   ORDER BY game_time DESC
   LIMIT $3`,
  [tid, competitionId, limit]
);
```

Mantiene el comportamiento actual y elimina el templated string completamente.

**Esfuerzo:** 30 min.

### 1.2 — `admin/server.js:69` — clamp de `?limit=`

**Archivo:** `admin/server.js` (línea 69)

**Cambio:**
```js
const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
```

Previene OOM por queries con `LIMIT 999999999`.

**Esfuerzo:** 5 min.

### 1.3 — `helmet()` en admin y bot HTTP

**Archivos:**
- `admin/server.js:11` — agregar `app.use(helmet({ contentSecurityPolicy: false }))` justo después de `app.use(express.json())`. CSP se deshabilita porque el admin usa CDN scripts que necesitan `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'` para Tailwind; configurar correctamente después en Fase 9.
- `src/interface/http/server.js` — agregar `helmet()` al stack de middleware de `createHttpServer` (línea 25).

**Esfuerzo:** 30 min.

### 1.4 — Rate limit en admin

**Archivo:** `admin/server.js`

**Cambio:** importar `express-rate-limit` (ya está en `package.json:22`) y aplicar:
```js
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});
app.use('/api/', adminLimiter);
```

**Nota:** el `trust proxy` ya está configurado en `dashboard/server/index.js:31`. Para admin standalone habría que replicarlo.

**Esfuerzo:** 20 min.

### 1.5 — SRI en admin CDN scripts

**Archivo:** `admin/public/index.html` (líneas 10-12)

**Cambio:** agregar `integrity="sha384-…"` y `crossorigin="anonymous"` a los `<script src="https://cdn.jsdelivr.net/…">` y `<script src="https://unpkg.com/…">`.

**Pasos para generar hashes:**
```bash
curl -s https://cdn.jsdelivr.net/npm/chart.js | openssl dgst -sha384 -binary | openssl base64 -A
curl -s https://unpkg.com/lucide@latest | openssl dgst -sha384 -binary | openssl base64 -A
```

**Nota:** si se usan versiones `@latest`, los hashes cambian con cada release. Mejor pinearlas a una versión fija y documentarlo en un comentario.

**Esfuerzo:** 15 min.

### 1.6 — Escape de LIKE wildcards

**Archivo:** `dashboard/server/controllers/athleteController.js` (línea 215)

**Cambio:** agregar helper local:
```js
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, '\\$&');
}
```

Y modificar línea 215:
```js
params.push(`%${escapeLike(String(search).toLowerCase())}%`);
```

Esto previene que un usuario que busca `100%` reciba todos los matches.

**Esfuerzo:** 15 min.

### 1.7 — Redaction de PII en `/api/queries`

**Archivo:** `admin/server.js` (líneas 67-83)

**Cambio:** el endpoint devuelve `consulta` (texto del usuario) y `respuesta` (respuesta del bot) completas. Recomiendo:
- Truncar `consulta` a 200 chars por default, overridable con `?full=1`.
- No devolver `respuesta` por default; requerir `?expand=1` para verla, y registrar el access en audit log (Fase 9).

```js
app.get('/api/queries', async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const fullText = req.query.full === '1';
    const expandResponse = req.query.expand === '1';
    const selectCols = fullText
      ? 'h.id, h.consulta, h.tipo, h.fecha, u.alias'
      : `h.id, LEFT(h.consulta, 200) AS consulta, h.tipo, h.fecha, u.alias${expandResponse ? ', LEFT(h.respuesta, 500) AS respuesta' : ''}`;
    const result = await pool.query(
      `SELECT ${selectCols}
       FROM historial_consultas h
       JOIN usuarios u ON h.id_usuario = u.id
       ORDER BY h.fecha DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/queries:', error);
    res.status(500).json({ error: 'Database error' });
  }
});
```

**Esfuerzo:** 30 min.

## Tests nuevos

- `admin/tests/server.test.js` (preview de Fase 8):
  - 503 sin `ADMIN_TOKEN`
  - 401 con token inválido
  - 200 con token válido
  - `?limit=999999` clampea a 500
  - `?full=1` devuelve `consulta` completa
  - Sin `?expand=1` NO devuelve `respuesta`
- Smoke test del dashboard: `curl /api/football/athletes?search=100%25` debe devolver matches que contienen literal `100%`, no todo.

## Criterios de aceptación

- [ ] `teamController.js:99` ya no usa string templated.
- [ ] `admin/server.js:69` clampea `limit` a [1, 500].
- [ ] `helmet()` presente en admin y bot HTTP server.
- [ ] Rate limit 100 req/15min en `/api/*` admin.
- [ ] SRI hashes agregados a scripts CDN del admin.
- [ ] Helper `escapeLike` implementado y usado en `athleteController.js`.
- [ ] `/api/queries` trunca `consulta` a 200 chars por default; `respuesta` requiere `?expand=1`.
- [ ] CI verde.

## Rollback

Revert del commit. Cambios aditivos — sin migraciones ni schema.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `dashboard/server/controllers/teamController.js` | ~20 líneas (refactor a `db.execAdvanced`) |
| `admin/server.js` | ~25 líneas (clamp + redaction en `/api/queries`) |
| `dashboard/server/controllers/athleteController.js` | ~5 líneas (helper + uso) |
| `src/interface/http/server.js` | ~3 líneas (helmet) |
| `admin/public/index.html` | ~3 líneas (SRI hashes en scripts) |