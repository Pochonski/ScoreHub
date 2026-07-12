# Mundialista Dashboard

Dashboard web premium para la Copa Mundial FIFA 2026.

## Stack

- React 19 + TypeScript 5.6
- Vite 6 (build/dev server)
- Tailwind CSS 4
- React Router 7
- Zod 4 (runtime validation)
- Express 4 + Pino (backend)
- Azure Cosmos DB (datos)

## Requisitos

- Node.js 18+
- npm 9+

## Instalación

```bash
# Frontend
npm install

# Backend (en otra carpeta o terminal)
cd server && npm install && cd ..
```

## Variables de Entorno

Copia `.env.example` a `.env` en la raíz del monorepo y configura:

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/football` | URL base del backend |
| `DASHBOARD_PORT` | `3002` | Puerto del servidor backend |
| `CORS_ORIGINS` | `http://localhost:5173,https://dashboard.mundialista.com` | Orígenes permitidos (CSV) |
| `SCORES365_COMPETITION_MUNDIAL` | `5930` | ID del mundial en 365scores |
| `SCORES365_SEASON` | `25` | Número de temporada |
| `LOG_LEVEL` | `info` | Nivel de log (info, warn, error, debug) |

## Desarrollo

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend (proxy a :3002 automático vía vite.config.ts)
npm run dev
```

Abre http://localhost:5173.

## Producción

```bash
npm run build
cd server && npm start
# Sirve en :3002: SPA estática + API
```

## Tests

```bash
# Tests frontend (Vitest)
npm test

# Tests backend (Jest)
cd server && npm test

# Coverage
npm run test:coverage
```

## Lint y Formato

```bash
npm run lint         # ESLint
npm run lint:fix     # ESLint con --fix
npm run format       # Prettier write
npm run format:check # Prettier check
```

## Build

```bash
npm run build       # Frontend SPA bundle en dist/
npm run preview     # Servir build localmente
```

## Estructura

```
dashboard/
├── src/
│   ├── domain/             # Entidades y contratos de repositorios
│   ├── data/               # Implementaciones de repositorios + datasources
│   ├── infrastructure/     # DI, HTTP client, logging, cache, errors
│   ├── presentation/       # UI: páginas, componentes, hooks
│   │   ├── pages/
│   │   ├── components/
│   │   │   ├── ui/         # Componentes reusables (Button, Card, ...)
│   │   │   ├── layout/     # PageShell, Navbar, Footer
│   │   │   ├── hero/
│   │   │   ├── matches/
│   │   │   ├── stats/
│   │   │   ├── standings/
│   │   │   ├── competition/
│   │   │   └── ...
│   │   └── hooks/          # Hooks de React para fetch + estado
│   ├── shared/             # Utilidades, tipos compartidos, sanitize
│   └── App.tsx
├── server/                 # Backend Express
│   ├── controllers/        # Handlers de rutas (1 por dominio)
│   ├── services/           # Lógica compartida (cache, cosmos, etc.)
│   ├── middleware/         # errorHandler, etc.
│   ├── utils/              # mappers, enrichers
│   └── routes/             # Definición de rutas
├── public/                 # Assets estáticos, manifest.json, robots.txt
└── tests/                  # Vitest unit/integration tests
```

## Deploy

PM2 está configurado en `server/ecosystem.config.js`:

```bash
pm2 start server/ecosystem.config.js
pm2 save
```

## Licencia

Privado. Todos los derechos reservados.