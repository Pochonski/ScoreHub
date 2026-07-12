# Fase 9 — Fix Críticos (Prioridad Inmediata)

**Objetivo:** Resolver los 46 hallazgos críticos que pueden causar crashes, bugs funcionales, vulnerabilidades de seguridad, o violaciones arquitectónicas graves.

**Esfuerzo estimado:** 3-4 días
**Dependencias:** Ninguna (punto de partida)

---

## 9.1 ErrorBoundary Global

**Archivo:** `src/App.tsx`
**Problema:** Cualquier excepción en una página rompe toda la app. `ErrorBoundary.tsx` (85 líneas con UI completa) nunca se importa.

**Acción:**
```tsx
import { ErrorBoundary } from '@/infrastructure/errors'

export default function App() {
  return (
    <ErrorBoundary>
      <PageShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/analisis" element={<AnalysisPage />} />
          <Route path="/competicion" element={<CompetitionPage />} />
          <Route path="/historial/:seasonNum" element={<HistoryEditionPage />} />
          <Route path="/player/:id" element={<PlayerProfilePage />} />
          <Route path="/partido/:id" element={<MatchDetailPage />} />
        </Routes>
      </PageShell>
    </ErrorBoundary>
  )
}
```

**Verificación:** Forzar un error en cualquier componente → ver UI de error con retry.

---

## 9.2 Integrar ErrorState en Pages

**Archivos:** Todas las pages
**Problema:** `ErrorState.tsx` existe pero ningún componente lo importa. Los hooks devuelven `error` pero las pages lo ignoran.

**Acción por page:**

| Page | Hooks con error | Dónde agregar ErrorState |
|---|---|---|
| `DashboardPage.tsx` | `useGames`, `useLiveGames` | Antes del `<MatchGrid>` cuando error |
| `AnalysisPage.tsx` | `useNews`, predicciones/tips inline | `<ErrorState message={error} onRetry={refetch} />` |
| `CompetitionPage.tsx` | `useTournamentInfo` | Cuando `!info && !infoLoading` |
| `MatchDetailPage.tsx` | `useGameDetail` | En lugar del contenido si error |
| `PlayerProfilePage.tsx` | `useAthletes` | Ya tiene manejo de error (verificar) |

**Patrón:**
```tsx
if (error) return <ErrorState message={error} onRetry={refetch} fullPage />
```

---

## 9.3 Unificar Acceso a Repositorios (DI vs Directo)

**Problema:** 7 archivos en `presentation/` importan repositorios concretos de `data/repositories/` directamente, BYPASSANDO el DI Container. Solo 4/10 repos están en DI.

**Archivos a corregir:**

| Archivo | Línea | Importa directamente | Debe usar |
|---|---|---|---|
| `hooks/useTeams.ts` | 4 | `ApiTeamRepository` | `DiContainer.getTeamRepository()` |
| `hooks/useAthletes.ts` | 3 | `ApiAthleteRepository` | `DiContainer.getAthleteRepository()` |
| `hooks/useGameDetail.ts` | 7-9 | `ApiGameRepository, apiClient, ENDPOINTS` | Solo `DiContainer.getGameRepository()` |
| `hooks/useHistory.ts` | 3 | `ApiHistoryRepository` | `DiContainer.getHistoryRepository()` |
| `hooks/useTournamentInfo.ts` | 3 | `ApiTournamentInfoRepository` | `DiContainer.getTournamentInfoRepository()` |
| `hooks/useStandings.ts` | 3 | `ApiStandingRepository` | `DiContainer.getStandingRepository()` |
| `components/explorer/PlayerSearch.tsx` | 4 | `ApiAthleteRepository` | `DiContainer.getAthleteRepository()` |

**Acción en `DiContainer.ts`:**
```typescript
getAthleteRepository(): AthleteRepository { return new ApiAthleteRepository() }
getTeamRepository(): TeamRepository { return new ApiTeamRepository() }
getHistoryRepository(): HistoryRepository { return new ApiHistoryRepository() }
getTournamentInfoRepository(): TournamentInfoRepository { return new ApiTournamentInfoRepository() }
getStandingRepository(): StandingRepository { return new ApiStandingRepository() }
```

**Nota:** Cambiar tipos de retorno de las clases concretas a las interfaces de `domain/`:
```typescript
// Antes: getGameRepository(): ApiGameRepository
// Después:
getGameRepository(): GameRepository { return new ApiGameRepository() }
```

---

## 9.4 Eliminar Duplicación de Entidades

**Problema:** `Prediction`, `PredictionOption`, `LineupMember` definidos en 2 archivos con tipos divergentes.

**Archivos afectados:**
- `domain/entities/Game.ts` (líneas 55-80) — tiene duplicados
- `domain/entities/Prediction.ts` (líneas 1-11) — original
- `domain/entities/Lineup.ts` (líneas 1-14) — original

**Acción:**
1. Eliminar de `Game.ts` las interfaces `PredictionOption`, `Prediction`, `LineupMember`
2. En `Game.ts`, importar desde `Prediction.ts` y `Lineup.ts`:

```typescript
import type { Prediction, PredictionOption } from './Prediction'
import type { Lineup, LineupMember } from './Lineup'
```

3. Unificar el tipo divergente:
   - Decisión: Usar `athleteId: number` en toda la app. Si puede ser undefined, usar `athleteId: number | null`

**Verificación:** `npx tsc -b --noEmit` debe compilar limpio.

---

## 9.5 Migrar Queries a Parámetros Vinculados (Backend)

**Problema:** ~27 de 30 queries en `footballController.js` interpolan valores directamente en strings SQL. Cosmos DB injection real.

**Archivo:** `dashboard/server/controllers/footballController.js`

**Patrón incorrecto (actual):**
```js
const query = `SELECT * FROM c WHERE c.competitionId = ${COMPETITION_PK} AND c.statusGroup IN (${groups.join(',')})`
```

**Patrón correcto:**
```js
const querySpec = {
  query: 'SELECT * FROM c WHERE c.competitionId = @compId AND c.statusGroup IN (@sg0, @sg1)',
  parameters: [
    { name: '@compId', value: COMPETITION_PK },
    { name: '@sg0', value: groups[0] },
    { name: '@sg1', value: groups[1] },
  ]
}
```

**Endpoints a migrar** (todos los que usan interpolación):
- `getMatches`
- `getMatchById`
- `getStandings`
- `getHistory`
- `searchAthletes`
- `getNews`
- todos los demás con `$` o `${}` en queries

---

## 9.6 Corregir Bug StandingMapper

**Archivo:** `src/data/mappers/StandingMapper.ts:37`
**Problema:** `goalDiff: raw.goalDiff as number || raw.ratio as number` — cuando `goalDiff = 0`, el `||` evalúa como falsy y asigna `ratio`.

**Acción:**
```typescript
goalDiff: (raw.goalDiff ?? raw.ratio) as number,
```

---

## 9.7 CORS Restringido + Helmet (Backend)

**Archivo:** `dashboard/server/index.js`

**Acción:**
```bash
# Instalar
npm install helmet express-rate-limit
```

```js
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const whitelist = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'https://dashboard.mundialista.com']

app.use(helmet())
app.use(cors({ origin: whitelist, credentials: true }))

// Rate limiting general
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}))
```

**Agregar al `package.json` del server:**
```json
"dependencies": {
  "helmet": "^8.0.0",
  "express-rate-limit": "^7.4.0"
}
```

---

## 9.8 Eliminar Dead Code

### `sanitize.ts`
**Problema:** `src/shared/sanitize.ts` nunca se importa en la app.
**Acción temporal:** Auditar `dangerouslySetInnerHTML`. Si ningún componente lo usa, mantener archivo pero no eliminarlo.

### `rateLimiter.ts`
**Problema:** `src/infrastructure/security/rateLimiter.ts` nunca se importa.
**Acción:** Eliminar archivo.

### `swr` de package.json
**Problema:** Dependencia declarada pero no usada.
**Acción:** Eliminar `"swr": "^2.0.0"` de `package.json`.

### `useAthleteSearch` hook
**Problema:** Hook definido en `useAthletes.ts:10-34` pero nunca usado.
**Acción:** Eliminar `useAthleteSearch` de `useAthletes.ts`.

---

## 9.9 Polling con Page Visibility (DashboardPage)

**Archivo:** `src/presentation/pages/DashboardPage.tsx:36-42`

**Acción:**
```tsx
useEffect(() => {
  if (liveGames.length === 0) return
  let intervalId: ReturnType<typeof setInterval>

  const handler = () => {
    if (!document.hidden) {
      refetchFeatured()
      refetchLive()
    }
  }

  intervalId = setInterval(handler, 30000)

  const onVisibilityChange = () => {
    if (document.hidden) {
      clearInterval(intervalId)
    } else {
      handler()
      intervalId = setInterval(handler, 30000)
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}, [liveGames.length, refetchFeatured, refetchLive])
```

---

## 9.10 Eliminar `featuredGame` Duplicado

**Archivo:** `src/presentation/pages/DashboardPage.tsx:17,25-27`

**Problema:** Estado duplicado `featuredGame` que copia `featured` del hook con un `useEffect`.

**Acción:** Eliminar la línea 17 y el useEffect (25-27). Usar `featured` del hook directamente.

```diff
- const [featuredGame, setFeaturedGame] = useState<Game | null>(null)
- useEffect(() => {
-   if (featured) setFeaturedGame(featured)
- }, [featured])
+ const featuredGame = featured
```

---

## Criterios de Aceptación Fase 9

- [ ] `npx tsc -b --noEmit` compila sin errores en dashboard/
- [ ] `npm test` pasa 38+ tests
- [ ] `npm run build` produce bundle exitoso
- [ ] ErrorBoundary global muestra UI de error ante crash
- [ ] ErrorState visible en páginas cuando hooks fallan
- [ ] No hay imports directos de `data/repositories/` en `presentation/`
- [ ] `Game.ts` no tiene interfaces duplicadas
- [ ] `StandingMapper.ts` corrige bug de goalDiff=0
- [ ] Backend con CORS whitelist, helmet, rate limiting
- [ ] Backend queries migradas a parámetros vinculados
- [ ] `swr` eliminado de dependencies
- [ ] `rateLimiter.ts` eliminado
- [ ] `useAthleteSearch` eliminado de useAthletes.ts
- [ ] Polling se pausa/reanuda con visibility change
- [ ] `featuredGame` sin estado duplicado
