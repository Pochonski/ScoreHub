# ScoreHub Dashboard

Dashboard web premium para la Copa Mundial FIFA 2026.

## Stack

- React 19 + TypeScript 5.6
- Vite 6 (build/dev server)
- Tailwind CSS 4 + React Router 7
- Zod 4 (runtime validation)
- Express 4 + Pino (backend logging)
- Supabase PostgreSQL (datos, vía `pg.Pool` sin ORM)
- Vercel (deploy del frontend + serverless API)

## Features

- Partidos en vivo con polling inteligente (pausa si pestaña oculta)
- Hero match animado con goal-ray effect y score shimmer
- Match grid filtrable y ticker scrolleable
- Tabla de posiciones con forma reciente
- Estadísticas del torneo: goleadores, asistencias, ratings
- Historial de ediciones anteriores con stats y lineups
- Búsqueda de jugadores con debounce y navegación por teclado
- Noticias con scroll infinito
- Code splitting por ruta (React.lazy + Suspense)
- PWA: service worker + manifest + runtime caching de imágenes
- Diseño responsive mobile-first con touch targets ≥44px
- Accesibilidad: aria-live, focus trap, roles ARIA, prefers-reduced-motion
- ErrorBoundary global + ErrorState por página con retry
- Zod schemas en todos los mappers con AppError tipado
- InMemoryCache con límite de entradas y stampede protection
- Analytics de bundle con `npm run analyze`

## Requisitos

- Node.js 18+
- npm 9+

## Instalación

```bash
# Frontend
npm install

# Backend
cd server && npm install && cd ..
```

## Variables de Entorno

Copia `.env.example` a `.env` y configura:

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/football` | URL base del backend |
| `DASHBOARD_PORT` | `3002` | Puerto del servidor backend |
| `CORS_ORIGINS` | `http://localhost:5173,https://scorehub-pocho.vercel.app` | Orígenes permitidos (CSV) |
| `LOG_LEVEL` | `info` | Nivel de log (info, warn, error, debug) |

> Nota: el servidor (`dashboard/server`) lee estas variables del `.env` de la **raíz del repo**, no de `dashboard/.env`. La competencia y temporada se controlan con `PRIMARY_COMPETITION_ID` y `PRIMARY_SEASON` (ver `.env.example` raíz).

## Desarrollo

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend (proxy a :3002 vía vite.config.ts)
npm run dev
```

Abre http://localhost:5173.

## Producción

El dashboard se deploya en **Vercel** (ver `vercel.json` y [docs/deploy-vercel.md](../docs/deploy-vercel.md)):

- El build de Vite produce `dashboard/dist/` (SPA + PWA).
- `api/index.js` es una serverless function que monta `dashboard/server/index.js` (Express).
- `/api/(.*)` se reescribe a la function; el resto sirve el SPA.

```bash
npm run build        # genera dist/
cd server && npm start   # o dejar que Vercel lo sirva como serverless
```

## Tests

```bash
# Tests frontend (Vitest) — 94 tests
npm test

# Tests backend (Jest + Supertest) — 10 tests
cd server && npm test
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server con HMR (Vite) |
| `npm run build` | TypeScript + Vite build + PWA SW |
| `npm run lint` | ESLint flat config |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | tsc --noEmit |
| `npm run analyze` | Build + bundle visualizer |
| `npm run test:coverage` | Coverage report |

## Seguridad

- **CORS whitelist**: solo orígenes configurados via `CORS_ORIGINS`
- **Helmet**: headers HTTP de seguridad (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting**: 100 req/min por IP en todas las rutas `/api/`
- **Queries parametrizadas**: todas las consultas PostgreSQL usan placeholders `$1, $2…` (sin interpolación de strings)
- **Graceful shutdown**: SIGTERM/SIGINT cierran conexiones limpiamente

## Bundle

```bash
npm run build
npm run analyze  # Abre treemap visual en dist/stats.html
```

| Chunk | Tamaño | Gzip |
|---|---|---|
| `index` (app shell) | 298 KB | 89 KB |
| `react` (React + ReactDOM + Router) | 48 KB | 17 KB |
| `CompetitionPage` | 29 KB | 6 KB |
| `MatchDetailPage` | 12 KB | 3 KB |
| `AnalysisPage` | 9 KB | 3 KB |
| `PlayerProfilePage` | 6 KB | 2 KB |
| `HistoryEditionPage` | 6 KB | 2 KB |

## Estructura

```
dashboard/
├── src/                      # Frontend (Clean Architecture)
│   ├── domain/               # Entidades + interfaces de repositorio
│   ├── data/                 # Repositorios (Api*Repository) + mappers con Zod
│   ├── infrastructure/       # DI Container, HttpClient, cache, logging, ErrorBoundary
│   ├── presentation/
│   │   ├── pages/            # 6 páginas (lazy loaded)
│   │   ├── components/       # ~40 componentes con React.memo
│   │   │   ├── ui/           # Accordion, ErrorState, Skeleton, ImageWithFallback, etc.
│   │   │   ├── hero/         # HeroMatch, BroadcastScore
│   │   │   ├── match-detail/ # 9 subcomponentes (MatchScoreCard, MatchLineups, etc.)
│   │   │   ├── matches/      # MatchCard, MatchGrid, MatchTicker, MatchFilterBar
│   │   │   ├── stats/        # TopScorers, Assists, Ratings, TeamOfWeek, StatRow
│   │   │   ├── competition/  # HistoryTab, BracketTree, HistoricalMatchStatsModal
│   │   │   ├── explorer/     # PlayerSearch, PlayerProfile, TeamCard
│   │   │   ├── news/         # NewsFeed, NewsCard
│   │   │   ├── trends/       # BettingTrends, MatchTips
│   │   │   └── standings/    # GroupStandings
│   │   └── hooks/            # 13 hooks con AbortController
│   ├── shared/               # Utilidades, tipos globales
│   └── App.tsx               # Layout shell + lazy routes + ErrorBoundary
├── server/                   # Backend Express
│   ├── controllers/          # 9 controllers (~130 líneas c/u)
│   ├── services/             # cacheService (thundering herd), mappers, enrichers
│   ├── middleware/            # errorHandler + helmet/rate-limit (en index.js)
│   ├── utils/                # mappers, helpers
│   └── routes/               # football.js (rutas a controllers)
├── public/                   # favicon.svg, manifest.json, robots.txt, sitemap.xml
├── tests/                    # 94 tests Vitest (componentes + hooks + mappers)
└── dist/                     # Build output (SPA + SW + workbox)
```

## Pre-commit

El proyecto usa **Husky + lint-staged**. Al hacer commit se ejecuta:

1. `prettier --write` en archivos staged `.ts`, `.tsx`, `.json`, `.css`, `.md`
2. `eslint --fix` en archivos staged `.ts`, `.tsx`

## Licencia

Privado. Todos los derechos reservados.