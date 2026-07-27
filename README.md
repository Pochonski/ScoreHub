# ScoreHub

Asistente de fútbol y apuestas multi-competición, con tres interfaces integradas sobre una base de datos común (Supabase PostgreSQL). Soporta Mundial 2026, Liga Promerica CR y futuras competiciones vía la tabla `active_competitions`.

[Bot de Telegram](https://t.me/botmundialistabot) · [Dashboard Web](https://scorehub-pocho.vercel.app) · [Documentación](./docs) · [Multi-comp](./docs/multi-competition.md)

---

## Qué hace

- **Bot de Telegram** (`@botmundialistabot`): la interfaz principal. Entiende español natural (vía Gemini) y ~50 comandos slash. Da partidos en vivo, fixture, tablas/grupos/llaves, info de equipos, H2H, alineaciones, previas, estadísticas, noticias, predicciones, cuotas, goleadores e historial de mundiales (1930–2022).
- **Dashboard web premium "ScoreHub"** (React 19 + Vite): centro de comando visual con partidos en vivo, marcadores animados, tablas, bracket, estadísticas, noticias y perfil de jugadores. Soporta múltiples competiciones con tabs y switcher en el navbar.
- **Panel admin**: UI interna para ver métricas de uso (usuarios, consultas, equipos seguidos).
- **Seguimiento de apuestas por captura**: el usuario manda una foto de su cupón de Bet365/Betway, Tesseract.js hace OCR, se normaliza a 9+ tipos de mercado, se empareja con un partido en vivo y cada 60s se notifica a Telegram cuando se gana/pierde cada selección.

## Arquitectura

```
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│  Telegram Bot   │   │  Dashboard (Web) │   │   Admin Panel   │
│ telegramBot.js  │   │ React 19 + Vite  │   │  admin/server   │
└────────┬────────┘   └────────┬─────────┘   └────────┬────────┘
         │                      │                      │
         └──────┬───────────────┴──────────────────────┘
                │
        ┌───────▼────────┐     ┌──────────────────────┐
        │  sync.js (cron)│────▶│  365scores Web API   │
        │  20 jobs ETL   │     │  webws.365scores.com │
        └───────┬────────┘     └──────────────────────┘
                │ upsert
        ┌───────▼────────┐
        │  Supabase PG   │  ◀── lectura: dashboard API + bot
        │  19 tablas JSON│
        └────────────────┘
```

- **NLU**: Gemini 2.5 Flash parsea español natural → intent.
- **OCR**: Tesseract.js extrae texto de cupones de apuestas.
- **Backend API**: Express + Helmet + CORS + rate-limit + Pino.
- **Frontend**: React 19 + TypeScript + Tailwind 4 + Zod 4 (Clean Architecture). Data fetching pasa por **TanStack Query** (cache, dedupe, refetch on focus, polling configurable).
- **DB**: Supabase PostgreSQL vía dos caminos:
  - **Supabase JS (HTTP)** cuando `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` están en env (default en Vercel): sin conexiones persistentes, ideal para serverless.
  - **pg Pool** (fallback): pool con `max=1`, usado para queries complejas (CTE, JOINs, JSONB) vía `db.execAdvanced()`.
  - 19 tablas cache JSONB.
- **Fuente datos**: API web de 365scores (`webws.365scores.com`).

> Activar el path HTTP en Vercel: ver [docs/migration-supabase-vercel.md §10](#activar-supabase-js-opcional). Verifica con `node scripts/check-supabase-config.js`.
- **Scheduling**: `node-cron` con 20 jobs en capas (15s, 1m, 2m, 5m, 10m, 6h, 24h).

## Stack

- **Runtime**: Node.js 18+ (CommonJS en raíz, ESM en dashboard).
- **Bot**: `node-telegram-bot-api`, WhatsApp legacy (inactivo por defecto).
- **Frontend**: React 19, React Router 7, Vite 6, TypeScript, Tailwind 4, Zod 4, **TanStack Query 5** (data fetching, cache, mutations).
- **DB**: Supabase PostgreSQL, `pg`, sin ORM.
- **Logs**: `pino` + `pino-http` + `pino-pretty`.
- **Seguridad**: `helmet`, `express-rate-limit`, CORS allowlist.
- **OCR**: `tesseract.js`.

## Estructura del repo

```
.
├── telegramBot.js          # Bot de Telegram (entrada principal)
├── bot.js                  # Bot de WhatsApp (legacy, inactivo)
├── sync.js                 # Servicio ETL con 20 crons
├── api/index.js            # Entry serverless para Vercel
├── handlers/               # Ruteo de mensajes (match, team, betting, OCR…)
├── services/               # Lógica de negocio (scores365, sync, bet evaluator…)
├── database/               # Conexión pg, schema.sql, migraciones
├── utils/                  # logger, processGuard, jobGuard, adminAuth, constants…
├── dashboard/              # SPA React (src/) + API Express (server/)
│   ├── server/             # Express API (/api/football/*)
│   ├── src/                # Clean Architecture (domain/data/infrastructure/presentation)
│   └── docs/               # Bitácora de las fases del dashboard
├── admin/                  # Panel admin (Express)
├── docs/                   # Documentación del proyecto
└── scripts/                # Herramientas one-off
```

## Setup rápido

```bash
# 1. Instalar dependencias
npm install                # raíz (bot + sync)
cd dashboard && npm install  # frontend
cd dashboard/server && npm install  # API

# 2. Configurar entorno
cp .env.example .env       # y completa los valores reales (Telegram, Gemini, Supabase)

# 3. Base de datos
# Las migraciones están en database/migrations/ (002-019). Aplicarlas en orden en Supabase.

# 4. Arrancar (en terminales separadas)
npm run start:telegram     # bot de Telegram (long-polling)
node sync.js                # servicio de sincronización (crons)
npm run start:dashboard     # API del dashboard (puerto 3002)
cd dashboard && npm run dev # frontend Vite (puerto 5173, proxy /api → 3002)
```

## Deploy

- **Dashboard + API**: Vercel (`vercel.json`, serverless function `api/index.js`). Ver [docs/deploy-vercel.md](./docs/deploy-vercel.md).
- **Bot + sync**: procesos long-running en un host aparte (VM, PM2, systemd).

## Documentación

- [docs/README.md](./docs/README.md) — índice de docs.
- [docs/bot-commands.md](./docs/bot-commands.md) — referencia de comandos del bot.
- [docs/env-vars.md](./docs/env-vars.md) — variables de entorno.
- [docs/migration-supabase-vercel.md](./docs/migration-supabase-vercel.md) — migración Cosmos→Supabase.
- [docs/deploy-vercel.md](./docs/deploy-vercel.md) — cómo deployar el dashboard.
- [dashboard/docs/](./dashboard/docs/) — bitácora de fases del dashboard.

## Estado

- WhatsApp: **legacy, inactivo** (se mantiene el código, no se invierte).
- Cosmos DB: **eliminado** (migrado a Supabase).
- Azure App Service: **eliminado** (migrado a Vercel).
- Supabase JS HTTP wrapper: **code completo**, **activación pendiente en Vercel** (agregar `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` como env vars — ver `docs/migration-supabase-vercel.md § 11`).

## Notas arquitectónicas

- **Frontend data fetching**: todos los hooks `useXxx` en `dashboard/src/presentation/hooks/` usan TanStack Query 5 internamente (preservando el shape externo de cada uno). El `QueryClient` se configura en `src/main.tsx` con `staleTime: 30s`, `refetchOnWindowFocus: true`, `retry: 1`. Refetch de live games cada 30s está configurado vía `refetchInterval` en `useLiveGames`.
- **Backend DB**: `database/db.js` ofrece dos vías:
  - `db.query/insert/upsert/update/remove` → Supabase JS (PostgREST HTTP, serverless-friendly, sin conexiones persistentes)
  - `db.execAdvanced` → `pg.Pool(max=1)` para queries con CTE/JSONB/multi-JOIN
  - El wrapper cae automáticamente a pg cuando `SUPABASE_URL` no está configurado (ver `scripts/check-supabase-config.js`).

## Licencia

Privado.

## Tareas manuales pendientes

Cosas que no se pueden automatizar desde código y requieren acción externa:

- **Renombrar el proyecto en Supabase**: el proyecto Supabase se llama "BotFutbolista" (un tercer nombre, distinto de `BotMundialista`/carpeta y `ScoreHub`/app). Para alinearlo, ir a la consola de Supabase → Project Settings → General → Name. No afecta a código ni connection strings.
- **Renombrar la carpeta del repo** `BotMundialista` → `scorehub`: requiere rename en GitHub + actualizar clones locales y el deploy de Vercel.

## Activar Supabase JS (HTTP) en Vercel

Por defecto el wrapper cae a `pg.Pool` (max=1) porque las credenciales HTTP no están configuradas. Para migrar al path HTTP sin conexiones persistentes (ideal en serverless):

1. Vercel Dashboard → Project Settings → Environment Variables
2. Agregar `SUPABASE_URL=https://jcfulxsqayscvqgxemhv.supabase.co`
3. Agregar `SUPABASE_SERVICE_ROLE_KEY=<eyJ...>` (NO la anon key — service_role hace bypass de RLS)
4. Redeploy para tomar efecto
5. Verifica en [`/api/football/health`](https://scorehub-pocho.vercel.app/api/football):
   - `dbStrategy: "http+pg-fallback"` ← HTTP activado
   - `dbStats.supabaseCalls` debería crecer con cada request

Diagnóstico local en cualquier momento:

```bash
node scripts/check-supabase-config.js
```

Salidas:
- `✓ Supabase JS HTTP path activated` — env vars OK
- `⚠ Supabase JS not configured, using pg fallback` — agregar env vars
