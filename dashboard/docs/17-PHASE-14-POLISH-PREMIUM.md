# Fase 14 — Polish Premium

**Objetivo:** Implementar lo que falta de Fase 4 de los docs originales: animaciones refinadas, focus traps, skeleton refinados, code splitting, bundle analyzer, métricas.

**Esfuerzo estimado:** 3-4 días
**Requisito:** Fases 9-13 completadas

---

## 14.1 Code Splitting (React.lazy + Suspense)

**En `App.tsx`:**
```tsx
import { lazy, Suspense } from 'react'

const DashboardPage = lazy(() => import('@/presentation/pages/DashboardPage'))
const AnalysisPage = lazy(() => import('@/presentation/pages/AnalysisPage'))
const CompetitionPage = lazy(() => import('@/presentation/pages/CompetitionPage'))
const HistoryEditionPage = lazy(() => import('@/presentation/pages/HistoryEditionPage'))
const MatchDetailPage = lazy(() => import('@/presentation/pages/MatchDetailPage'))
const PlayerProfilePage = lazy(() => import('@/presentation/pages/PlayerProfilePage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-accent-live/30 border-t-accent-live rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <PageShell>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analisis" element={<AnalysisPage />} />
            <Route path="/competicion" element={<CompetitionPage />} />
            <Route path="/historial/:seasonNum" element={<HistoryEditionPage />} />
            <Route path="/player/:id" element={<PlayerProfilePage />} />
            <Route path="/partido/:id" element={<MatchDetailPage />} />
          </Routes>
        </Suspense>
      </PageShell>
    </ErrorBoundary>
  )
}
```

---

## 14.2 Focus Traps

**Componentes que lo necesitan:**
- `PlayerSearch.tsx` (dropdown de búsqueda)
- `HistoricalMatchStatsModal.tsx` (modal)

**Implementar con `@react-aria/focus`:**
```bash
npm install @react-aria/focus
```

```tsx
import { FocusScope } from '@react-aria/focus'

function PlayerSearch() {
  const [open, setOpen] = useState(false)
  return (
    <FocusScope contain={open} restoreFocus autoFocus>
      <div role="combobox" aria-expanded={open}>
        <input
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {open && <DropdownList />}
      </div>
    </FocusScope>
  )
}
```

---

## 14.3 Score Shimmer + Goal Ray (Animaciones)

**En `BroadcastScore.tsx`:**
```tsx
const prevScore = useRef(homeScore)

useEffect(() => {
  if (homeScore > prevScore.current) {
    setGoalAnim(true)
    setTimeout(() => setGoalAnim(false), 800)
  }
  prevScore.current = homeScore
}, [homeScore])

return (
  <div className="relative overflow-hidden">
    {goalAnim && <div className="goal-ray absolute top-0 left-0 h-full" />}
    <span className={`score-animate ${goalAnim ? 'scale-110' : ''}`}>
      {homeScore}
    </span>
  </div>
)
```

---

## 14.4 Stagger Entrance Animations

**En `MatchGrid.tsx`:**
```tsx
{filteredGames.map((game, i) => (
  <div
    key={game.id}
    style={{ animationDelay: `${i * 50}ms` }}
    className="card-enter"
  >
    <MatchCard game={game} />
  </div>
))}
```

**Eliminar reglas CSS `:nth-child(1-6)` de `globals.css`** (no funcionan correctamente porque dependen del padre en lugar del grupo renderizado).

---

## 14.5 Bundle Analyzer

```bash
npm install --save-dev rollup-plugin-visualizer
```

**En `vite.config.ts`:**
```typescript
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ open: true, gzipSize: true, brotliSize: true }),
  ],
})
```

**Script:**
```json
"scripts": {
  "analyze": "vite build && npx vite-bundle-visualizer"
}
```

---

## 14.6 Aria-live Regions

**Agregar `role="status"` y `aria-live="polite"` en:**
- HeroMatch (score cambia)
- MatchTicker (partidos en vivo se actualizan)
- DashboardPage (indicador "Actualizando cada 30s")
- NewsFeed (nuevas noticias cargadas)

```tsx
<section aria-live="polite" role="status" aria-label="Partidos en vivo">
  <MatchTicker games={liveGames} />
</section>
```

---

## 14.7 Fallback de Imágenes CDN

**Crear placeholder genérico:**
```tsx
const TeamBadgeFallback = () => (
  <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center">
    <span className="text-text-dim text-xs">?</span>
  </div>
)
```

---

## Criterios de Aceptación Fase 14

- [ ] Code splitting con `React.lazy` en las 6 rutas
- [ ] Focus trap funcional en PlayerSearch y modales
- [ ] Goal ray animation funcional en BroadcastScore
- [ ] Stagger entrance en MatchGrid (delay incremental)
- [ ] Bundle analyzer generando reporte < 200KB gzip
- [ ] `aria-live="polite"` en secciones dinámicas
- [ ] `role="status"` en indicador de actualización
- [ ] Fallback visual para imágenes rotas de CDN
- [ ] Bundle JS por ruta medido y optimizado
