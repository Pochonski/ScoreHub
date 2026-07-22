# Deploy — ScoreHub Dashboard (Vercel)

> **Estado actual:** el dashboard y la API viven en **Vercel**. El workflow de
> Azure (`/.github/workflows/azure.yml`) fue **eliminado** en julio 2026 porque
> apuntaba a una infraestructura (Cosmos DB + Azure App Service) que ya no se
> usa. Ver `docs/migration-supabase-vercel.md` para el contexto de la migración.

## Arquitectura de deploy

```
Vercel
├─ Build:    vite build (dashboard/) → dashboard/dist
├─ Static:   dashboard/dist/  servido como SPA
└─ Function: api/index.js  (serverless, 512 MB, maxDuration 30s)
             reescribe /api/(.*) → function
             ↳ monta dashboard/server/index.js (Express + Helmet + CORS + rate-limit)
             ↳ lee del pool de Supabase Postgres (database/connection.js)
             ↳ llama a 365scores directo para datos live
```

## Configuración en Vercel

Definida en `vercel.json`:

- **Build Command:** construye el SPA de Vite en `dashboard/dist`.
- **Output Directory:** `dashboard/dist`.
- **Serverless Function:** `api/index.js` (re-exporta `dashboard/server/index.js`).
- **Rewrites:** todo `/api/(.*)` va a la function; el resto al SPA (`index.html`).
- **Recursos:** 512 MB de memoria, 30 s de duración máxima por invocación.

## Variables de entorno (Vercel → Project Settings → Environment Variables)

Mínimas para que arranque la API:

| Variable | Ejemplo | Notas |
|---|---|---|
| `SUPABASE_DB_URL` | `postgresql://postgres.xxxx@aws-0-xx.pipeliner.supabase.com:6543/postgres` | Pooler Supavisor. Alternativa: usar `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_SSL=true`. |
| `PRIMARY_COMPETITION_ID` | `5930` | Mundial 2026. |
| `PRIMARY_SEASON` | `25` | |
| `CORS_ORIGINS` | `https://scorehub-pocho.vercel.app` | Separar por comas. Si no se setea, default seguro (localhost + URL Vercel). |
| `SCORES365_HTTP_TIMEOUT_MS` | `15000` | Timeout por request a 365scores. |
| `LOG_LEVEL` | `info` | |
| `NODE_ENV` | `production` | |

Para el **build del frontend** (Vite necesita las que empiezan con `VITE_`):

| Variable | Ejemplo |
|---|---|
| `VITE_API_BASE_URL` | `/api/football` |

## Cómo hacer deploy

- **Automático:** cualquier push a `master` dispara el deploy de Vercel
  (integración con GitHub en la consola de Vercel).
- **Manual:** `vercel --prod` desde la raíz del repo (requiere Vercel CLI).

## Cómo correr localmente

```bash
# 1. Dashboard API + Express (puerto 3002)
npm run start:dashboard

# 2. En otra terminal, frontend Vite dev (puerto 5173, proxy /api → 3002)
cd dashboard && npm run dev
```

## Cosas que NO están en Vercel

- El **bot de Telegram** (`telegramBot.js`) y el **sync service** (`sync.js`)
  no son serverless: son procesos long-running con crons. Se ejecutan en un
  host aparte (VM, PM2, systemd, contenedor) usando `npm run start:telegram`
  y `node sync.js`.
- El **panel admin** se sirve dentro del proceso del bot (`/admin/*`) o standalone
  con `npm run admin` (requiere `ADMIN_STANDALONE=true`).
