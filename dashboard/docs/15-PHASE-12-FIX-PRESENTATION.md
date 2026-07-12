# Fase 12 — Fix Presentación

**Objetivo:** Dividir monolitos, agregar React.memo/useMemo, estandarizar componentes, mejorar responsive, integrar ErrorState.

**Esfuerzo estimado:** 4-5 días
**Requisito:** Fase 9 (ErrorBoundary + ErrorState + DI)

---

## 12.1 Dividir MatchDetailPage (341 líneas → 9 componentes)

**Archivo:** `src/presentation/pages/MatchDetailPage.tsx`

**Componentes a extraer:**

| Componente nuevo | Responsabilidad |
|---|---|
| `MatchHeader` | Título, fecha, navegación atrás |
| `MatchScoreCard` | Marcador principal, estado, minuto |
| `MatchStatsTable` | Tabla de estadísticas (posesión, tiros, etc.) |
| `MatchLineups` | Alineaciones titulares + banco |
| `MatchTimeline` | Timeline de eventos (goles, tarjetas) |
| `MatchPredictions` | Predicciones de la comunidad |
| `MatchTips` | Tips de apuestas |
| `MatchSuggestions` | Partidos sugeridos |
| `MatchNews` | Noticias relacionadas |

**Cada componente:** ~30-50 líneas, props tipadas, estados loading/error.

---

## 12.2 Extraer AccordionSection

**Carpeta destino:** `src/presentation/components/ui/Accordion.tsx`

```tsx
interface AccordionSectionProps {
  title: string
  defaultOpen?: boolean
  icon?: ReactNode
  children: ReactNode
  badge?: string | number
}

export function AccordionSection({ title, defaultOpen, icon, children, badge }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const id = useId()
  return (
    <div className="...">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="..."
      >
        {icon}{title}{badge}
        <ChevronIcon open={open} />
      </button>
      <div id={id} role="region" hidden={!open} className="...">
        {children}
      </div>
    </div>
  )
}
```

**Reemplazar en:**
- `BracketsTab.tsx` (3 ocurrencias)
- `HistoricalMatchStatsModal.tsx` (1)
- `HistoryEditionPage.tsx` (inline)
- `StandingsTab.tsx` (1)
- `StatsTab.tsx` (1)

---

## 12.3 Agregar React.memo y useMemo

### React.memo en:
- `MatchCard.tsx`
- `StatRow.tsx`
- `TeamBadge.tsx`
- `FormDot.tsx`
- `ConfidenceBar.tsx`
- `NewsCard.tsx`
- `MatchTicker.tsx`

### useMemo en:
- `DashboardPage.tsx`: `gamesByDateOffset`, `filteredGames`, `filterCounts`
- `MatchGrid.tsx`: ordenamiento/agrupación de partidos
- `HistoryEditionPage.tsx`: navegación (prev/next), sorted
- `BracketsTab.tsx`: agrupación por fase

---

## 12.4 Extraer Funciones de Fecha Compartidas

**Archivo nuevo:** `src/presentation/utils/dates.ts`

```typescript
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Hoy'
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Mañana'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
```

**Reemplazar implementaciones inline en:**
- `HeroMatch.tsx`
- `MatchCard.tsx`
- `MatchDetailPage.tsx`
- `HistoryEditionPage.tsx`
- `HistoryTab.tsx`
- `BracketsTab.tsx`

---

## 12.5 onError con Estado en Imágenes

**Patrón a aplicar en todos los componentes con imágenes:**
- `MatchDetailPage.tsx:179`
- `PlayerProfile.tsx:82,138`
- `BroadcastScore.tsx:54,84`
- `TeamBadge.tsx`
- `PlayerSearch.tsx`

```diff
- <img src={url} onError={(e) => { e.target.style.display = 'none' }} />
+ const [imgError, setImgError] = useState(false)
+ {!imgError && <img src={url} onError={() => setImgError(true)} />}
```

---

## 12.6 A11Y — Emojis con aria-label

**Buscar y corregir todos los emojis sin aria-label:**

```diff
- <span>⚽</span>
+ <span role="img" aria-label="Gol">⚽</span>
```

**Timeline en MatchDetailPage.tsx:** Agregar `aria-label` a todos los eventos.

---

## 12.7 Touch Targets (WCAG 2.5.5)

**Buscar elementos interactivos con dimensiones < 44px:**

| Archivo | Elemento | Tamaño actual |
|---|---|---|
| `StatRow.tsx:24` | Botón de detalle | `w-7 h-7` (28px) |
| `MatchTicker` | Items del ticker | puede ser < 44px |
| `FilterBar` | Botones de filtro | verificar |

**Acción:** Cambiar a `w-11 h-11` (44px) o agregar padding interno.

---

## 12.8 Scroll Restoration + Scroll to Top

**En `App.tsx`:**
```tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// En App:
<ErrorBoundary>
  <ScrollToTop />
  <PageShell>
    <Routes>...</Routes>
  </PageShell>
</ErrorBoundary>
```

---

## Criterios de Aceptación Fase 12

- [ ] `MatchDetailPage.tsx` dividido en ≤9 subcomponentes
- [ ] `AccordionSection` unificado en `ui/Accordion.tsx`, eliminadas 5 copias
- [ ] `React.memo` en ≥6 componentes
- [ ] `useMemo` en cómputos derivados de DashboardPage, MatchGrid, BracketsTab
- [ ] Funciones de fecha extraídas a `utils/dates.ts`, sin duplicados inline
- [ ] `onError` en imágenes usa estado, no manipula DOM
- [ ] Emojis en timeline con `aria-label`
- [ ] Botones con touch target ≥44px
- [ ] Scroll to top al navegar
