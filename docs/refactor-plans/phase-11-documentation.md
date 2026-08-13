# Fase 11 — Documentación

**Estado:** ⏳ Pendiente
**Esfuerzo:** 2 h
**Riesgo:** Mínimo
**Bloquea deploy:** No
**PR:** `hardening/phase-11-docs`

## Objetivo

Sincronizar la documentación con el nuevo estado del proyecto:
- README menciona WEBHOOK_SECRET, ADMIN_TOKEN ≥32, hardening completo.
- `docs/env-vars.md` documenta nuevas variables.
- `docs/security.md` (nuevo) con threat model.
- `docs/architecture.md` refleja Fase 3 (ports tipados) y Fase 4 (config unificada).

## Cambios

### 11.1 — `README.md`

**Archivo:** `README.md`

**Cambios:**
1. Actualizar sección "Tareas manuales pendientes" — eliminar items resueltos.
2. Agregar sección "Seguridad" con link a `docs/security.md`.
3. Actualizar "Stack" si se agregaron herramientas en Fases previas (e.g. express-rate-limit ya estaba).
4. Tabla rápida de las Fases del plan en sección "Refactorización": link a `docs/refactor-plans/audit-master-plan.md`.

**Esfuerzo:** 30 min.

### 11.2 — `docs/env-vars.md`

**Archivo:** `docs/env-vars.md`

**Cambios:**
1. Agregar `WEBHOOK_SECRET` con instrucciones de `openssl rand -hex 32` y `setWebhook`.
2. Actualizar `ADMIN_TOKEN` con requisito ≥32 chars.
3. Actualizar `CORS_ORIGINS` con nota "DEBE estar seteado en producción".
4. Documentar `ADMIN_AUDIT_FILE` (de Fase 9).
5. Documentar `__DOTENV_LOADED__` flag interno (de Fase 4).
6. Agregar tabla resumen de "required vs optional vs production-only".

**Esfuerzo:** 30 min.

### 11.3 — `docs/security.md` (nuevo)

**Archivo:** `docs/security.md`

**Contenido:**
```md
# Seguridad ScoreHub

## Modelo de amenaza

ScoreHub es un servicio público (bot de Telegram + dashboard web). Las superficies
de ataque son:
- Telegram Bot API (long-polling o webhook).
- Dashboard API serverless (Vercel).
- API del bot standalone (PM2).
- Panel admin autenticado por token.

## Controles activos (post-Fase 9)

- Helmet + CSP en dashboard y admin.
- express-rate-limit (100 req/15min en admin, 100 req/min en dashboard).
- Webhook firmado con X-Telegram-Bot-Api-Secret-Token.
- Admin: ADMIN_TOKEN ≥32 chars, comparación constant-time.
- SQL injection: todos los queries parametrizados o via PostgREST builder.
  Guards `assertIdent`/`assertSelectList` en pg fallback.
- XSS: cero `innerHTML` con user-controlled input en admin (post-Fase 0).
- PII redaction: Pino redact paths cubren text/body/message/headers/env vars.
- Audit log en admin con redacción de tokens.

## Reporte de vulnerabilidades

Email: <responsible-disclosure@example.com> (configurar en deploy)
GPG key: <fingerprint>

## Historial de auditorías

- 2026-Q3: [`audit-master-plan.md`](./refactor-plans/audit-master-plan.md) —
  12 fases de remediación. Fases 0-1 críticas, 2-12 mejoras incrementales.
```

**Esfuerzo:** 30 min.

### 11.4 — `docs/architecture.md`

**Archivo:** `docs/architecture.md`

**Cambios:**
1. Sección "Domain (ports + entities)" — actualizar para reflejar que los ports ahora son factories tipadas (Fase 3).
2. Sección "Backend DB" — mencionar el `pg_advisory_lock` en `migrate.js` (Fase 6).
3. Sección "Configuración" — mencionar el módulo unificado `src/infrastructure/config.js` (Fase 4).
4. Sección "Composition roots" — mencionar graceful shutdown con `flushSync` (Fase 5).

**Esfuerzo:** 30 min.

### 11.5 — `docs/refactor-plans/README.md`

**Archivo:** `docs/refactor-plans/README.md`

**Cambio:** agregar la serie "Audit 2026-Q3" al índice con link a `audit-master-plan.md`.

**Esfuerzo:** 5 min.

### 11.6 — `docs/bot-commands.md`

**Archivo:** `docs/bot-commands.md`

**Cambio:** actualizar si algún comando cambió comportamiento en Fases 3-5 (poco probable, validar).

**Esfuerzo:** 15 min.

## Criterios de aceptación

- [ ] README menciona hardening y link a security.md.
- [ ] env-vars.md actualizado con todas las vars nuevas.
- [ ] security.md creado con threat model.
- [ ] architecture.md sincronizado con Fases 3-5.
- [ ] refactor-plans/README.md tiene índice de audit-2026-q3.

## Rollback

Revert del commit. Cambios docs.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `README.md` | ~20 líneas (sección Seguridad) |
| `docs/env-vars.md` | ~40 líneas (vars nuevas) |
| `docs/security.md` (nuevo) | ~80 líneas |
| `docs/architecture.md` | ~30 líneas (sync) |
| `docs/refactor-plans/README.md` | ~5 líneas (link) |
| `docs/bot-commands.md` | ~10 líneas (validación) |