# Variables de entorno

El bot, sync y dashboard leen las variables del `.env` de la raíz del repo.
Ver [`.env.example`](../.env.example) para una plantilla copiable.

## Categorías

### 1. Competiciones (multi-comp)

Las competiciones activas se leen de la tabla `active_competitions` en la DB
(migración 008). Las env vars de esta sección son solo **fallbacks** para el
caso en que la tabla esté vacía o para identificar la "primary comp" en el frontend.

| Var | Default | Notas |
|---|---|---|
| `PRIMARY_COMPETITION_ID` | `5930` | ID upstream del Mundial 2026; fallback si `?competitionId=` no se pasa en la request |
| `PRIMARY_SEASON` | `25` | Temporada del Mundial |
| `CURRENT_SEASON` | `25` | Alias usado por algunos controllers |
| `SYNC_START_DATE` | `20260601` | (legacy) Inicio de ventana para `syncGames` cuando no se usa `start_date` de la tabla |
| `SYNC_END_DATE` | `20260815` | (legacy) Fin de ventana |

Para añadir más competiciones, **insertar en `active_competitions`** (no requiere redeploy).
Ver [`docs/multi-competition.md`](./multi-competition.md) para el detalle.

### 2. Base de datos (Supabase PostgreSQL)

Opción A (preferida, usa pooler Supavisor):

| Var | Ejemplo | Notas |
|---|---|---|
| `SUPABASE_DB_URL` | `postgresql://postgres.xxxx@aws-0-xx.pipeliner.supabase.com:6543/postgres` | Una sola URL |

Opción B (fallback, variables individuales):

| Var | Ejemplo | Notas |
|---|---|---|
| `DB_HOST` | `db.tu-proyecto.supabase.co` | |
| `DB_PORT` | `5432` (directo) o `6543` (pooler) | |
| `DB_USER` | `postgres` | |
| `DB_PASSWORD` | `xxxxx` | |
| `DB_NAME` | `postgres` | |
| `DB_SSL` | `true` | Recomendado en producción |
| `DB_POOL_MAX` | `25` | Tamaño del pool de conexiones |

### 3. APIs externas

| Var | Servicio | Notas |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini | Para NLU (parseo de intent) y generación de respuestas |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo a usar |
| `TELEGRAM_BOT_TOKEN` | Telegram BotFather | Para el bot de Telegram |

### 4. 365scores (web API)

| Var | Default | Notas |
|---|---|---|
| `SCORES365_TIMEZONE` | `America/Costa_Rica` | Zona horaria |
| `SCORES365_USER_COUNTRY` | `153` | ID de Costa Rica en 365scores |
| `SCORES365_LANG` | `14` | 14 = español |
| `SCORES365_APP_TYPE` | `5` | 5 = web |
| `SCORES365_POLL_MS` | `25000` | Cada cuánto el `liveGamesPoller` hace requests |
| `SCORES365_MIN_INTERVAL_MS` | `120` | Throttle mínimo entre llamadas HTTP |
| `SCORES365_HTTP_TIMEOUT_MS` | `15000` | Timeout por request HTTP a 365scores |

### 5. Notificaciones live

| Var | Default | Notas |
|---|---|---|
| `ENABLE_LIVE_NOTIFIER` | `false` | Si `true`, `telegramBot.js` registra el listener del notifier |

### 6. Panel admin — auth

| Var | Default | Notas |
|---|---|---|
| `ADMIN_TOKEN` | (vacío) | Token para acceder a `/admin/*`. Si no se setea (o mide < 8 chars), el admin queda **deshabilitado** (503). Se envía como `Authorization: Bearer <token>` o cookie `admin_token`. |
| `ADMIN_STANDALONE` | `false` | Si `true`, el admin corre como servidor Express separado |

### 7. Servidores y logging

| Var | Default | Notas |
|---|---|---|
| `PORT` | `8080` | Puerto HTTP del health server (bot) |
| `ADMIN_PORT` | `3001` | Puerto del panel admin standalone |
| `DASHBOARD_PORT` | `3002` | Puerto del dashboard server |
| `CORS_ORIGINS` | `http://localhost:5173,https://scorehub-pocho.vercel.app` | Orígenes permitidos para el dashboard (CSV) |
| `LOG_LEVEL` | `info` | Nivel de log pino (info, warn, error, debug) |
| `NODE_ENV` | — | `production` activa comportamiento de prod |

### 8. WhatsApp (legacy, inactivo)

| Var | Default | Notas |
|---|---|---|
| `WA_SESSION_DIR` | `.wwebjs_auth` | Directorio de sesión de WhatsApp Web |

---

## Variables por componente

| Componente | Variables principales |
|---|---|
| `telegramBot.js` | `TELEGRAM_BOT_TOKEN`, `SCORES365_*`, `GEMINI_*`, `DB_*`, `ADMIN_TOKEN` |
| `bot.js` (WhatsApp legacy) | `DB_*`, `SCORES365_*`, `GEMINI_*`, `WA_SESSION_DIR` |
| `sync.js` | `DB_*`, `SCORES365_*`, `PRIMARY_*`, `SYNC_*` |
| `services/scores365Service.js` | `SCORES365_*` |
| `services/geminiService.js` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `services/liveGamesPoller.js` | `SCORES365_*`, `PRIMARY_COMPETITION_ID` |
| `services/telegramNotifier.js` | `ENABLE_LIVE_NOTIFIER` (gate) |
| `dashboard/server/index.js` | `DASHBOARD_PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, `DB_*`/`SUPABASE_DB_URL`, `PRIMARY_*` |
| `admin/server.js` | `ADMIN_TOKEN`, `DB_*`, `ADMIN_PORT` |

---

## Costes estimados

| Servicio | Tier | Coste/mes |
|---|---|---|
| Supabase PostgreSQL | Free | $0 |
| Gemini 2.5 Flash | Free | $0 (~1,500 req/día) |
| 365scores (web) | — | $0 (público) |
| Vercel | Hobby | $0 |
| **TOTAL** | | **$0/mes** |
