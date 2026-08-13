# Migración: Azure → Supabase + Vercel

## 1. Resumen

Eliminar toda dependencia de Azure (Cosmos DB, App Service, Managed Identity) y migrar a:

- **Supabase** (PostgreSQL) para datos del bot: usuarios, apuestas, equipos seguidos, estado de live polling
- **365scores API directa** para datos del dashboard: partidos, tabla, estadísticas, historial, atletas, noticias
- **Vercel** para hosting: frontend (Vite static) + backend (Express serverless)

## 2. Arquitectura

### Antes (Azure)

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ Browser  │───▶│ Express  │───▶│ Cosmos DB   │◀───│ 365scores   │
│ (Vite)   │    │ :3002    │    │ (29 ctrs)   │    │ API (cache) │
└──────────┘    └──────────┘    └──────────────┘    └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ PostgreSQL   │ (bot data)
                 │ (Supabase)   │
                 └──────────────┘
```

### Después (Supabase + Vercel)

```
┌──────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Browser  │───▶│ Vercel           │───▶│ 365scores API   │
│ (Vite)   │    │ Frontend (CDN)   │    │ (directo, live) │
└──────────┘    │ Backend (Fn)     │    └──────────────────┘
                └──────────────────┘
                        │
                 ┌──────────────┐
                 │ Supabase     │ (solo bot data
                 │ PostgreSQL   │  + live state)
                 └──────────────┘
```

## 3. Fase 1 — Quitar Cosmos DB, API Directa a 365scores

### 3.1 Archivos eliminados / adaptados

| Archivo | Estado |
|---------|--------|
| `database/cosmos.js` | Reemplazado por stub que tira error claro ✅ |
| `scripts/cosmos-bootstrap.js` | Eliminado ✅ |
| `services/cosmosRefresh.js` | Eliminado ✅ |
| `services/liveGamesPoller.js` | Adaptado: Cosmos → Supabase `scores365_state` ✅ |
| `ecosystem.config.js` (root + dashboard/server) | Eliminado ✅ |
| `scripts/*.ps1` | Eliminado ✅ |

### 3.2 Dependencias a remover

**`package.json` (root):**

```diff
- "@azure/cosmos": "^4.9.3"
- "@azure/identity": "^4.13.1"
```

Scripts a eliminar de `package.json`:

```diff
- "cosmos:bootstrap": "node scripts/cosmos-bootstrap.js"
- "cosmos:refresh": "node services/cosmosRefresh.js"
- "cosmos:poller": "node services/liveGamesPoller.js"
- "test:365": "node scripts/test-365-mundial.js"
- "azure:pause-neighbours": "..."
- "azure:resume-neighbours": "..."
- "azure:pg-stop": "..."
- "azure:pg-start": "..."
- "azure:watchdog-pg": "..."
- "azure:install-watchdog": "..."
```

### 3.3 Variables de entorno

**Eliminar:**
- `COSMOS_ENDPOINT`
- `COSMOS_DATABASE`
- `COSMOS_KEY`

**Conservar:**
- `SCORES365_TIMEZONE` = `America/Costa_Rica`
- `SCORES365_USER_COUNTRY` = `153`
- `SCORES365_LANG` = `14`
- `SCORES365_APP_TYPE` = `5`
- `SCORES365_POLL_MS` = `25000`
- `PRIMARY_COMPETITION_ID` = `5930`
- `SCORES365_MIN_INTERVAL_MS` = `120`
- `PRIMARY_SEASON` = `25`

**Agregar:**
- `DB_HOST` = `db.jcfulxsqayscvqgxemhv.supabase.co`
- `DB_PASSWORD` = `<REDACTED_PASSWORD>`
- `TELEGRAM_BOT_TOKEN` = `<REDACTED_BOT_TOKEN>`
- `GEMINI_API_KEY` = `<REDACTED>`

### 3.4 Health check

```javascript
// Antes: consulta Cosmos DB
// Después:
app.get('/api/football/health', async (req, res) => {
  res.json({
    status: 'ok',
    datasource: '365scores',
    cache: 'memory',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
```

### 3.5 Cache Service

Extender `dashboard/server/services/cacheService.js` con TTL por tipo de dato. Los TTL sugeridos:

| Tipo | TTL | Datos |
|------|-----|-------|
| catalog | 1h | equipos, países, competiciones |
| games | 1min | lista de partidos |
| standings | 2min | tabla de posiciones |
| stats | 5min | scorers, asistencias, ratings |
| history | 10min | historial de mundiales |
| news | 10min | noticias |
| athletes | 1h | perfiles de atletas |
| trends | 2min | tendencias de apuestas |
| predictions | 2min | predicciones |
| match_detail | 5min | detalle de partido (h2h, lineups) |
| match_live | 0 (no cache) | datos en vivo |

### 3.6 Migración de controllers (9 archivos)

Cada controller sigue este patrón:

```javascript
// Antes (Cosmos DB):
const cosmos = require('../../database/cosmos');
const docs = await cosmos.queryAll('games', {
  query: 'SELECT * FROM c WHERE c.competitionId = @id',
  parameters: [{ name: '@id', value: compId }],
});

// Después (365scores directo + cache):
const api = require('../../services/scores365Service');
const cache = require('../services/cacheService');

const CACHE_KEY = `games:${compId}`;
let data = cache.get(CACHE_KEY, 'games');
if (!data) {
  data = await api.getGamesAllScores(startDate, endDate);
  // filtrar por compId si es necesario
  cache.set(CACHE_KEY, 'games', data);
}
```

#### 3.6.1 `infoController.js`
- **Antes:** consulta `catalog` container por countries y competitions
- **Después:** `scores365.getSports()` para países; `scores365.getCompetition(MUNDIAL_ID)` para info torneo
- **Cache:** catalog (1h)

#### 3.6.2 `teamController.js`
- **Antes:** consulta `catalog` por entityType='competitors'
- **Después:** `scores365.getTopCompetitors(limit)` para listado; `scores365.getCompetition(MUNDIAL_ID)` extrae equipos relacionados
- **Cache:** catalog (1h)

#### 3.6.3 `athleteController.js`
- **Antes:** consulta `athletes` container
- **Después:** `scores365.getAthlete(id)` para perfil individual; `scores365.getAthleteNextGame(id)` para próximo partido; extrae miembros desde `scores365.getCompetition()` para búsqueda
- **Cache:** athletes (1h), careers/trophies/transfers (1h)

#### 3.6.4 `newsController.js`
- **Antes:** consulta `news` container
- **Después:** `scores365.getCompetition(MUNDIAL_ID)` trae campo `news` embebido; si no trae, se omite
- **Cache:** news (10min)

#### 3.6.5 `trendController.js`
- **Antes:** consulta `trends` container
- **Después:** `scores365.getOddsLines(gameId)` para cuotas; `scores365.getPredictions(sport)` para predicciones; `scores365.getGameSuggestions()` para tips
- **Cache:** trends (2min)

#### 3.6.6 `statsController.js`
- **Ya tiene** fallback a `scores365.getTournamentStats()`
- **Cambio:** invertir — API first, cache en memoria, eliminar Cosmos
- **Cache:** stats (5min)

#### 3.6.7 `historyController.js`
- **Ya tiene** fallback a `scores365.getCompetitionHistory()`
- **Cambio:** invertir. Cache in-memory con TTL 10min (ya existe `_historyCache`)
- **Cache:** history (10min)

#### 3.6.8 `standingController.js`
- **Ya tiene** fallback a `scores365.getStandings()`
- **Cambio:** invertir. Cache 2min.
- **Cache:** standings (2min)

#### 3.6.9 `matchController.js`
- **Ya tiene** múltiples fallbacks: `getGameOverview()`, `getGamePreStats()`, `getGameSuggestions()`
- **Cambio:** invertir TODAS las rutas. Cache por tipo.
- **Cache:** games (1min), match_detail (5min), match_live (no cache)

### 3.7 Pruebas

```bash
cd dashboard/server && npm test   # 9 tests ✅
cd dashboard && npm test           # 94 tests ✅
```

## 4. Fase 2 — Supabase (bot data + live state) — COMPLETADA ✅

### 4.1 Conexión

`database/connection.js` usa `pg` pool. Funciona directo cuando el host tenga IPv6.

```env
DB_HOST=db.jcfulxsqayscvqgxemhv.supabase.co    ← con prefijo db.
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=postgres
DB_SSL=true
```

### 4.2 Schema

Ejecutar en Supabase SQL Editor (o local con IPv6):

1. `database/schema.sql` — tablas: `usuarios`, `equipos_seguidos`, `historial_consultas`, `apuestas`, `apuesta_selecciones`, `eventos_apuesta`
2. `database/migrations/002_scores365_state.sql` — tabla `scores365_state` para delta tracking
3. `database/migrations/003_bet_followers.sql` — tabla `bet_followers` para follow/unfollow de tickets (nueva)

### 4.3 Bot data flow

- **Telegram bot** (`telegramBot.js`) usa `database/connection.js` directamente
- **Servicios del bot** migrados de Cosmos a Supabase/365scores:

| Archivo | Cosmos eliminado | Reemplazo |
|---------|-----------------|-----------|
| `services/mundialCache.js` | queryAll/getById a `catalog`, `games`, `athletes` | 365scores API + caché in-memory |
| `services/matchSearch.js` | queryAll a `games` | `mundialCache.getRecentWorldCupGames()` |
| `services/liveGamesPoller.js` | getById/upsert a `games` (state), upsert a `game_snapshots` | Supabase `scores365_state` para last_update_id; snapshots en memoria + live API |
| `services/betEvaluator.js` | queryAll/upsert a `game_snapshots`, `bet_followers` | Supabase `scores365_state.last_snapshot` + `bet_followers` |
| `handlers/followHandler.js` | getById/upsert/deleteDoc a `bet_followers` | PostgreSQL upsert en tabla `bet_followers` |
| `handlers/mundialistaStatsHandler.js` | queryAll/getById a `news`, `highlights`, `brackets`, `competition_history`, `tournament_stats` | `scores365.getNews()`, `getTeamOfWeek()`, `getBrackets()`, `getCompetitionHistory()`, `getTournamentStats()` |
| `handlers/mundialista365Handler.js` | getById/queryOne a `games`, `game_overviews`, `game_h2h`, `game_pre_stats`, `odds_lines`, `betting_tips`, `trends`, `predictions`, `fixtures`, `odds_misc` | `scores365Service` APIs directas |
| `telegramBot.js` | `require('./database/cosmos')`, getById a `fixtures`, queryOne/getById a `athlete_next_games`, `athlete_chart_events` | `scores365Service` + handlers migrados |

### 4.4 Live poller

`liveGamesPoller.js` ya escribe `last_update_id` a Supabase `scores365_state`. Los snapshots se obtienen via API en vivo. No persiste snapshots completos para evitar tamaño excesivo; en su lugar `getStatsVivo()` consulta la API en vivo si no hay snapshot en memoria.

## 5. Fase 3 — Deploy en Vercel

### 5.1 Estructura

```
/
├── api/
│   └── index.js              ← Entry point serverless (Express adaptado)
├── dashboard/
│   ├── dist/                 ← Build output (gitignored)
│   ├── src/                  ← React app
│   ├── vite.config.ts
│   └── package.json
├── vercel.json               ← Configuración Vercel
├── package.json              ← Dependencias backend
└── .env                      ← No se sube (se configuran env vars en Vercel)
```

### 5.2 `vercel.json`

```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "cd dashboard && npm run build",
  "outputDirectory": "dashboard/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" }
  ],
  "functions": {
    "api/index.js": {
      "memory": 512,
      "maxDuration": 30
    }
  }
}
```

### 5.3 Entry point serverless (`api/index.js`)

```javascript
const app = require('./dashboard/server/index');
module.exports = app;
```

Vercel con `@vercel/node` wrappea automáticamente la app Express en serverless function.

### 5.4 Frontend build

```bash
cd dashboard && npm run build
# Output: dashboard/dist/
```

Vercel sirve el frontend desde CDN. Las rutas `/api/*` se rewriten a la serverless function.

### 5.5 Environment Variables en Vercel

Configurar en Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `SCORES365_TIMEZONE` | `America/Costa_Rica` |
| `SCORES365_USER_COUNTRY` | `153` |
| `SCORES365_LANG` | `14` |
| `SCORES365_APP_TYPE` | `5` |
| `PRIMARY_COMPETITION_ID` | `5930` |
| `SCORES365_MIN_INTERVAL_MS` | `120` |
| `PRIMARY_SEASON` | `25` |
| `SCORES365_POLL_MS` | `25000` |
| `TELEGRAM_BOT_TOKEN` | `<REDACTED_BOT_TOKEN>` |
| `GEMINI_API_KEY` | `<REDACTED>` |
| `DB_HOST` | `db.jcfulxsqayscvqgxemhv.supabase.co` |
| `DB_PORT` | `5432` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `<REDACTED_PASSWORD>` |
| `DB_NAME` | `postgres` |
| `DB_SSL` | `true` |
| `CORS_ORIGINS` | `https://mundialista.vercel.app` |
| `LOG_LEVEL` | `info` |
| `NODE_ENV` | `production` |

### 5.6 Deploy steps

```bash
# 1. Build frontend
cd dashboard && npm run build

# 2. Instalar Vercel CLI
npx vercel login

# 3. Deploy
npx vercel --prod

# Alternativa: conectar repo GitHub desde Vercel Dashboard
```

## 6. Credenciales

| Servicio | Dato |
|----------|------|
| **Supabase host** | `db.jcfulxsqayscvqgxemhv.supabase.co` |
| **Supabase password** | `<REDACTED_PASSWORD>` |
| **Telegram bot token** | `<REDACTED_BOT_TOKEN>` |
| **Telegram bot name** | `SabelotodoFutbolBot` |
| **Gemini API key** | `<REDACTED>` |
| **365scores comp ID** | `5930` (Mundial 2026) |
| **365scores appType** | `5` |
| **365scores lang** | `14` (es-419) |
| **365scores country** | `153` (Costa Rica) |

## 7. Rollback

Si algo falla:

1. **Git:** `git checkout -- .`
2. **Vercel:** `npx vercel remove botmundialista`

## 8. Estado actual

| Fase | Estado |
|------|--------|
| Fase 1: Quitar Cosmos + API directa (dashboard) | ✅ Completada |
| Fase 2: Schema Supabase + migración bot services | ✅ Completada |
| Verificación local (tests) | ✅ 94 frontend + 9 backend tests |
| Fase 3: Vercel deploy | ⏳ Pendiente — requiere vercel.json + build setup |

### Próximos pasos

1. ✅ Migraciones SQL ejecutadas en Supabase (8 tablas creadas)
2. ✅ `api/index.js` creado
3. ✅ `vercel.json` creado
4. ✅ Build frontend exitoso (`dashboard/dist/`)
5. **Deploy:** `npx vercel --prod`
6. Configurar env vars en Vercel Dashboard (sección 5.5)

## 9. Migration runner

Las migrations se rastrean en la tabla `schema_migrations` (creada en migration 013).

**Para aplicar nuevas migrations:**

```bash
# 1. Crear archivo SQL numerado, ej: database/migrations/018_my_change.sql
# 2. Cerrar con:
#    INSERT INTO schema_migrations (name) VALUES ('018_my_change')
#      ON CONFLICT (name) DO NOTHING;

# 3. Aplicar manualmente:
PGSSLMODE=require psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f database/migrations/018_my_change.sql
```

Cada migration DEBE terminar con un `INSERT` en `schema_migrations` (excepto 013 que es la que crea la tabla). Esto es idempotente.

Orden de migrations aplicadas:

| # | Nombre | Resumen |
|---|--------|---------|
| 002 | scores365_state | live poller state |
| 003 | bet_followers | tickets con chat_ids TEXT[] |
| 004 | scores365_data | competiciones, juegos, atletas, news |
| 005 | venues | venues 365scores |
| 006 | match_detail | overviews, h2h, pre_stats, lineups, stats |
| 007 | athletes_canonical | re-key a canonical_id + dedup |
| 008 | active_competitions | multi-comp table |
| 009 | transfers_suggestions | transfers + suggestions |
| 010 | history_enhancements | champion lookup + values JSONB |
| 011 | athletes_source | source CHECK constraint |
| 012 | competitors_name_trgm | pg_trgm GIN index |
| 013 | schema_migrations | tracking table |
| 014 | add_indexes | 9 nuevos índices |
| 015 | check_constraints | CHECKs en apuestas, selecciones, eventos, followers |
| 016 | foreign_keys | FKs hacia usuarios (apuestas, equipos_seguidos, historial) |
| 017 | baseline_to_timestamptz | TIMESTAMP → TIMESTAMPTZ en tablas baseline |

## 10. Rollback strategy

Cada migration tiene un contraparte de rollback documentada en `docs/refactor-plans/03-data-model.md`. Los archivos `NNN_rollback.sql` NO se aplican automáticamente — sirven como guía si una migration falla a medio aplicar.

## 11. Activar Supabase JS (HTTP) en Vercel

Por defecto `database/db.js` cae a `pg.Pool(max=1)` cuando `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no están configuradas. Activar el wrapper HTTP elimina conexiones persistentes (mejor para serverless) y reduce la contención del pool.

### Paso 1 — Obtener credenciales desde Supabase

1. Ve a <https://supabase.com/dashboard/project/jcfulxsqayscvqgxemhv>
2. **Settings → API**
3. Sección **Project API keys**:
   - Copia **URL** (formato `https://jcfulxsqayscvqgxemhv.supabase.co`)
   - Copia **service_role** (NO anon) — es la clave que bypass RLS y tiene full admin access

> **Importante**: la clave `service_role` es SECRET. NUNCA commitearla al repo. Solo añadirla en el dashboard de Vercel.

### Paso 2 — Configurar en Vercel

1. Ve a <https://vercel.com/dashboard> → tu proyecto (`scorehub` o `botmundialista`)
2. **Settings → Environment Variables**
3. Añadir dos variables:
   - `SUPABASE_URL` = `https://jcfulxsqayscvqgxemhv.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = la JWT que copiaste
4. Marcar para **Production**, **Preview** y **Development** (opcional)
5. Save → trigger automático de redeploy (o manual con `npx vercel --prod`)

### Paso 3 — Validar

```bash
# Desde cualquier lugar con el repo (sin credenciales, devuelve error controlado):
node scripts/check-supabase-config.js

# Esperado cuando TODO está bien:
# ✓ Supabase JS HTTP path activated
# ✓ HTTP roundtrip to https://jcfulxsqayscvqgxemhv.supabase.co/rest/v1 succeeded in <N>ms
# ✓ HTTP query to active_competitions returned N rows
#  → first row: id=...
```

Verificar también en producción:

```bash
curl https://scorehub-pocho.vercel.app/api/football/health | jq
```

Debe mostrar `"dbStrategy": "http+pg-fallback"` y `dbStats.supabaseCalls > 0` después de unos requests.

### Rollback si algo falla

1. Vercel → Settings → Environment Variables → desactivar (o borrar) las dos vars
2. Re-deploy → el wrapper cae automáticamente a pg fallback

### Por qué service_role y no anon key

| Key | Permisos | Quién debería usarla |
|---|---|---|
| `anon` | RLS-enabled (políticas de seguridad) | Cliente frontend (sin secrets) |
| `service_role` | Bypass RLS, full admin | Backend server-side SOLAMENTE |

El backend en Vercel lee la service_role del env var y la pasa al cliente Supabase JS que ejecuta SQL con bypass de RLS. El frontend NUNCA debería ver esta clave.

### Monitoreo post-activación

```bash
# Ver ratio de llamadas HTTP vs pg:
watch 'curl -s https://scorehub-pocho.vercel.app/api/football/health | jq .dbStats'
```

Esperado en producción: `supabasePercent > 80%` después de los primeros minutos de tráfico.

## 12. Auditoría 2026-Q3 — Cambios de mantenimiento

### Migración 025 (`DROP bet_followers v1`)

Antes de aplicar:

```bash
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM bet_followers;"
```

Si retorna > 0: migrar datos a `bet_followers_v2` primero (migración 019). Si retorna 0, aplicar:

```bash
node database/migrate.js   # aplica 025
```

Verificar:

```bash
psql "$SUPABASE_DB_URL" -c "\d bet_followers"   # debe decir "no existe"
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM bet_followers_v2;"
```

### Lock de migraciones concurrentes

`database/migrate.js` ahora usa `pg_advisory_lock(5930)` para evitar
ejecuciones paralelas. Si dos runs compiten, el segundo sale con exit code 2.
Seguro de integrar en CI:

```bash
node database/migrate.js   # idempotente, gate-serializado por advisory lock
```

### Variables de entorno — Fase 0 (2026-Q3)

Agregar a `.env` y a las variables de Vercel:

- `WEBHOOK_SECRET=<openssl rand -hex 32>` — usado para validar
  `X-Telegram-Bot-Api-Secret-Token` en `/webhook`. Si no se setea en
  producción, el endpoint responde 503 (fail-safe).
- `ADMIN_TOKEN` debe medir ≥ 32 chars (validación endurecida en `utils/adminAuth.js`).
- `CORS_ORIGINS` debe estar seteado explícitamente en producción (ya no hay
  default con dominios de Vercel).

### Cambios de comportamiento

- `readThrough` cache (`database/db.js:451`) usa `inFlight` Map para deduplicar
  fetcher() y upsert() concurrentes por key. Elimina la race condition que
  duplicaba writes bajo carga.
- Webhook funciona en fail-safe: sin `WEBHOOK_SECRET` + `NODE_ENV=production`
  → 503. En desarrollo sigue funcionando como antes.
- Health endpoint del bot HTTP lleva headers de Helmet (HSTS, X-Frame-Options,
  etc.) sin necesidad de express.
