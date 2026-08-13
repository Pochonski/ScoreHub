# Seguridad ScoreHub

Documento vivo de postura de seguridad. Última revisión: 2026-08-11 (Auditoría 2026-Q3).

## Modelo de amenaza

ScoreHub es un servicio público (bot de Telegram + dashboard web + panel admin). Las superficies de ataque son:

- **Telegram Bot API** (long-polling o webhook firmado).
- **Dashboard API serverless** (Vercel) — sólo GET, datos públicos cacheados.
- **API del bot standalone** (PM2) — webhook, /health, /admin.
- **Panel admin** autenticado por token estático.

## Controles activos (post-Fase 9)

### Capa de transporte
- HTTPS forzado en todos los endpoints externos.
- TLS en conexiones a Supabase (con `rejectUnauthorized: false` para Supavisor — documentado).
- SRI hashes en scripts CDN del admin.

### Autenticación
- **Webhook**: validación de `X-Telegram-Bot-Api-Secret-Token` (header Telegram estándar). Fail-safe: en producción sin `WEBHOOK_SECRET`, el endpoint devuelve 503.
- **Admin**: `ADMIN_TOKEN` ≥ 32 chars vía constante-time compare (`Buffer.equals`). Acepta `Authorization: Bearer` o cookie `admin_token`. Sin token → 503.

### Rate limiting
- Dashboard: `express-rate-limit` 100 req/min por IP.
- Admin: `express-rate-limit` 100 req/15min en `/api/*`.
- Bot HTTP: limiter in-memory 30 req/min en `/health` y `/`.

### Headers de seguridad
- Helmet activo en dashboard server (defaults: CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- Helmet en admin (CSP permisivo para CDN scripts).
- Security headers manuales en bot HTTP server (X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS en producción).
- CSP meta en `dashboard/index.html`.

### SQL injection
- Todos los queries parametrizados o vía PostgREST builder.
- Guards `assertIdent`/`assertSelectList` en pg fallback (regex estricto, 11+ tests de fuzzing).
- Pool pg con `pgQueryRetry` ante errores transitorios.

### XSS
- Cero `innerHTML` con input user-controlled en `admin/public/index.html` (Fase 0).
- Helper `escapeHtml` aplicado en 11+ sinks.
- `dangerouslySetInnerHTML`/`eval`/`Function` no usados en dashboard.
- `sanitizeUrl`/`sanitizeHtml` helpers en `dashboard/src/shared/sanitize.ts`.

### Privacidad / PII
- Pino redact paths cubren `text`, `body`, `message`, `req.headers.authorization`, `req.headers.cookie`, `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `DB_PASSWORD`, `SUPABASE_DB_URL`.
- `/api/queries` redacta `consulta` (truncada a 200 chars) y oculta `respuesta` por default (requiere `?expand=1`).
- Audit log en admin redacta tokens en headers (`x-telegram-bot-api-secret-token`, `Authorization`).

### Audit log
- `utils/adminAudit.js` (Pino separado) registra cada request autenticado al admin con method/url/status/durationMs/ip.
- Storage configurable vía `ADMIN_AUDIT_FILE` (default: stdout).

## Vulnerabilidades remediadas en este ciclo (Q3 2026)

| ID | Hallazgo | Fase | Estado |
|---|---|---|---|
| C1 | XSS en `admin/public/index.html` (11 sinks sin escape) | 0 | ✅ Cerrado |
| C2 | Webhook sin `X-Telegram-Bot-Api-Secret-Token` | 0 | ✅ Cerrado |
| C3 | Race condition en `database/db.js:readThrough` (2 fetcher por key) | 2 | ✅ Cerrado |
| S3 | `teamController.js:99` PostgREST `or` string-templated | 1 | ✅ Cerrado |
| S4 | `admin/server.js:69` `?limit=` sin upper bound (OOM) | 1 | ✅ Cerrado |
| S5 | Sin rate limit en admin | 1 | ✅ Cerrado |
| S6 | Sin helmet en admin ni bot HTTP | 1 | ✅ Cerrado |
| S7 | Sin SRI en CDN scripts del admin | 1 | ✅ Cerrado |
| S8 | LIKE wildcards sin escapar (`%`, `_`) | 1 | ✅ Cerrado |
| S9 | CORS production hardcodeado | 2 | ✅ Cerrado |
| S11 | `/api/queries` devuelve `consulta`+`respuesta` completas | 1 | ✅ Cerrado |

## Configuración mínima segura

```bash
# .env.example provee placeholders. Reemplazar antes de producción:

TELEGRAM_BOT_TOKEN=<token real de BotFather>
GEMINI_API_KEY=<key real de Google AI Studio>
SUPABASE_DB_URL=postgresql://...con password...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<eyJ...>  # service_role, NO anon
WEBHOOK_SECRET=<openssl rand -hex 32>  # si usás webhook
ADMIN_TOKEN=<openssl rand -hex 32>  # ≥ 32 chars
NODE_ENV=production
CORS_ORIGINS=https://tu-dominio.com  # NO usar localhost en prod
DB_PASSWORD=<password real>
LOG_LEVEL=info
ENABLE_LIVE_NOTIFIER=false  # activar sólo si necesitás
```

## Auditorías

- 2026-Q3: [`AUDIT-2026-Q3.md`](../refactor-plans/AUDIT-2026-Q3.md) — informe completo.
- [`audit-master-plan.md`](../refactor-plans/audit-master-plan.md) — plan de remediación con 12 fases.
- [`audit-checklist.md`](../refactor-plans/audit-checklist.md) — checklist operacional.

## Reporte de vulnerabilidades

Para reportar vulnerabilidades, abrir un issue en GitHub con prefijo `[security]` o contactar al maintainer directamente. NO incluir detalles sensibles en issues públicos hasta coordinar el fix.

## Limitaciones conocidas

- **WebSocket / SSE**: no usados; no aplica.
- **CSRF**: dashboard API es GET-only, no requiere CSRF. Admin usa Bearer header (no cookie automático).
- **CORS**: el dashboard confía en whitelist explícita; en producción, `CORS_ORIGINS` DEBE estar configurado.
- **Telegram webhook secret**: el secret es estático; rotación requiere redeploy. Si necesitás rotación automática, considerar JWT con TTL.