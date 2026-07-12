# Fase 13 — Quality Infrastructure

**Objetivo:** Agregar ESLint, Prettier, testing infraestructura, PWA, SEO, y documentación faltante.

**Esfuerzo estimado:** 3-4 días
**Requisito:** Fases 9-12 (código base estabilizado)

---

## 13.1 ESLint + Prettier + Husky

**Dashboard `package.json` devDependencies:**
```json
{
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "prettier": "^3.4.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

**Archivos de configuración:**
- `eslint.config.js` (flat config ESLint 9)
- `.prettierrc` (semi, singleQuote, tabWidth 2, trailingComma es5)
- `.husky/pre-commit` (lint-staged)
- `lint-staged.config.js` (format + lint en staged files)

**Scripts:**
```json
"scripts": {
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix",
  "format": "prettier --write src/",
  "format:check": "prettier --check src/",
  "typecheck": "tsc -b --noEmit"
}
```

---

## 13.2 Tests de Componentes (RTL)

**Prioridad:**
1. `HeroMatch.test.tsx` — renderiza, verifica marcador, skeletons
2. `MatchCard.test.tsx` — renderiza con diferentes estados (live/upcoming/finished)
3. `Navbar.test.tsx` — enlaces, menú mobile
4. `MatchGrid.test.tsx` — lista de partidos, loading, empty
5. `Skeleton.test.tsx` — verifica shimmer animation class

**Setup en `tests/setup.ts`:**
```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

**Ejemplo:**
```typescript
// tests/components/HeroMatch.test.tsx
import { render, screen } from '@testing-library/react'
import { HeroMatch } from '@/presentation/components/hero/HeroMatch'
import { createMockGame } from '../factories/game'

describe('HeroMatch', () => {
  it('renderiza marcador cuando el partido está en vivo', () => {
    const game = createMockGame({ status: 'live' })
    render(<HeroMatch game={game} />)
    expect(screen.getByText(game.homeTeam.score)).toBeInTheDocument()
  })

  it('renderiza skeleton compact sin datos', () => {
    render(<HeroMatch game={null} compact />)
    expect(screen.getByTestId('hero-skeleton')).toBeInTheDocument()
  })
})
```

**Archivo de factories:**
```typescript
// tests/factories/game.ts
export function createMockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    status: 'live',
    homeTeam: { id: 1, name: 'Brasil', score: 2 },
    awayTeam: { id: 2, name: 'Argentina', score: 1 },
    startTime: new Date().toISOString(),
    stageName: 'Final',
    competitionId: 5930,
    ...overrides,
  } as Game
}
```

---

## 13.3 PWA — Service Worker + Manifest

**Archivo nuevo:** `public/manifest.json`
```json
{
  "name": "Mundialista 2026",
  "short_name": "Mundialista",
  "description": "Centro de comando de la Copa Mundial FIFA 2026",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#070B15",
  "theme_color": "#070B15",
  "icons": [
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

**En `vite.config.ts`:**
```typescript
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png}'],
      runtimeCaching: [{
        urlPattern: /^https?:\/\/imagecache\.365scores\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'images', expiration: { maxEntries: 50 } }
      }]
    }
  })
]
```

---

## 13.4 SEO — Open Graph + JSON-LD + Meta Tags

**En `index.html`:**
```html
<meta property="og:title" content="Mundialista 2026 — Dashboard" />
<meta property="og:description" content="Centro de comando del Mundial FIFA 2026. Partidos en vivo, tabla de posiciones, estadísticas y más." />
<meta property="og:image" content="https://botmundialista.azurewebsites.net/og-image.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Copa Mundial FIFA 2026",
  "startDate": "2026-06-11",
  "endDate": "2026-08-15",
  "location": { "@type": "Place", "name": "Estados Unidos, México, Canadá" }
}
</script>
```

**Assets:** Crear `public/robots.txt` y `public/sitemap.xml`.

---

## 13.5 README + .env.example

**Archivo nuevo:** `dashboard/README.md`
```markdown
# Mundialista Dashboard

Dashboard web premium para la Copa Mundial FIFA 2026.

## Requisitos

- Node.js 18+
- npm/pnpm

## Instalación

```bash
npm install
cd server && npm install && cd ..
```

## Variables de Entorno

Copy `.env.example` to `.env` and fill:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/football` | Backend API URL |
| `DASHBOARD_PORT` | `3002` | Backend port |

## Desarrollo

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend (con proxy a :3002)
npm run dev
```

## Producción

```bash
npm run build
cd server && npm start
# Sirve en :3002: SPA + API
```

## Tests

```bash
npm test          # Unit tests
npm run coverage  # Coverage report
```
```

**Archivo nuevo:** `dashboard/.env.example`
```env
VITE_API_BASE_URL=/api/football
DASHBOARD_PORT=3002
CORS_ORIGINS=http://localhost:5173,https://dashboard.mundialista.com
SCORES365_COMPETITION_MUNDIAL=5930
```

---

## Criterios de Aceptación Fase 13

- [ ] ESLint 9 flat config funcionando con `npm run lint`
- [ ] Prettier formateando con `npm run format`
- [ ] Husky ejecutando lint-staged en pre-commit
- [ ] ≥10 tests de componentes con RTL
- [ ] `manifest.json` y `vite-plugin-pwa` configurados
- [ ] Open Graph + JSON-LD + Twitter cards en index.html
- [ ] `robots.txt` + `sitemap.xml` en public/
- [ ] README.md con instrucciones de setup
- [ ] `.env.example` con variables documentadas
