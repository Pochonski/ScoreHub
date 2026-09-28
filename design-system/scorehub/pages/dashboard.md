# Dashboard Page Overrides — ScoreHub (oscuro denso)

> **PROJECT:** ScoreHub
> **Page:** dashboard (`DashboardPage.tsx` + rails)
> Reglas aquí **sobrescriben** `MASTER.md`. Lo no listado usa Master.

---

## Desviaciones verificadas

### Layout (difiere del Hero-Centric genérico)
- **Desktop:** grid 3 columnas `280px_minmax(0,1fr)_320px`, cada columna con su propio `overflow-y-auto` (`DashboardPage.tsx:493`). Max `1400px`.
- **Mobile/tablet:** solo columna central; grid de partidos en `MatchGrid`; hero compacto fijo `top-14` al hacer scroll (`heroCompact` + IntersectionObserver).
- **Densidad:** alta (dials `--density 8` aplicaría escala 8-32px, pero el CLI con variance 8 devolvió `Brutalism` + `Enterprise Gateway` — **descartado por off-topic** para entretenimiento deportivo; se mantiene escala Master 4-64px + gaps `gap-3/gap-5`).

### Componentes propios
- `HeroMatch` / `FeaturedHero` + `BroadcastScore` (marcador `clamp(56px,10vw,96px)`, `goal-ray` + `score-animate` 0.6s, `aria-live polite` solo en vivo).
- `MatchTicker` (snap-x, `no-scrollbar` + `scroll-fade-right`, flechas md+ con `group-focus-within` para teclado).
- `MatchFilterBar` (`aria-pressed`, conteos, calendario modal `role=dialog aria-modal`).
- Rails: `LeaguesRail`, `StandingsRail`, `StatsRail`, `NewsRail`, `TeamOfWeekPitch`.
- Live status atómico: `role=status aria-live=polite aria-atomic` con texto contextual "Actualizando cada 30s" (no número suelto) — verificado `ux: Contextual Live Badge Updates`.

### Motion (verificado `gsap: Stagger List Subtle`)
- NO hay GSAP instalado: usar solo CSS existente (`fade-in-up` + `stagger-enter` ≤400ms, delays 0-50-...-400ms).
- Si se añade GSAP algún día: tier Subtle `gsap.from('.list-item',{opacity:0,y:8,duration:0.3,stagger:0.03})`, clase estable (no índice), `matchMedia(reduced-motion)` → estado final inmediato. NO usar tier Complex/SplitText en listas (solo titulares <8 palabras).
- Dials `--motion 6` devolvió stagger Standard `back.out(1.4)` 300-450ms — **no aplicar** (rompe sobriedad deportiva + perf en listas vivas); mantener 150-300ms Master.

### Producto / Landing (verificado `product`, `landing`)
- `product: Sports Team/Club` → primario `Vibrant & Block-based + Motion-Driven`, secundarios `Dark Mode (OLED)`, dashboard `Performance Analytics`, foco `Team colors + Energetic accents` → justifica Master oscuro + acentos gold/blue/green.
- `landing: hero-testimonials-cta` y `newsletter-content-first` — **no aplican** (no es landing de conversión; sin testimonios ni newsletter). Hero es ticker en vivo, CTA son acciones contextuales por card.

### Tipografía (verificado `typography`, `google-fonts`)
- `typography: Sports/Fitness (Barlow Condensed + Barlow)` y `Bold Statement (Bebas Neue)` — **informativo, no adoptar** (producto ya usa `Teko/Sora/JetBrains Mono` con identidad + display deportivo; cambiar rompería consistencia).
- `google-fonts: Stint Ultra Condensed / Saira Extra/Semi Condensed / Noto Emoji / Pontano Sans` — ninguna iguala Teko actual; **no cambiar**. Nota: `Noto Emoji` confirma no usar emojis como iconos.

### Iconos (verificado `icons: bell arrow navigation` → Phosphor)
- Verificado: `Bell` (Phosphor, `import { Bell } from '@phosphor-icons/react'`, `<Bell size={20} weight="regular" />`), `ArrowLeft` (back/breadcrumb), `Compass` (navegación). Regla semántica: decorativo junto a texto → `aria-hidden`; significativo sin texto → alternativa textual; en control → nombre accesible + estado.
- Estado actual: SVG inline propio consistente (stroke 1.8, 24px en BottomNav, 14-16px en ticker/filtros) — **mantener**; si se migra, usar Phosphor con mismos tamaños/pesos. Queries deportivas (`live ball trophy whistle`, `trophy football navigation`) → **sin match verificado** (doble intento vacío); no inventar iconos deportivos, usar general + fallback Heroicons.

### Responsive mobile/tablet (auditoría 2026-09-27, verificado `ux: Touch Friendly/Touch Spacing/Touch Target Size`, `web: Safe Area`)
- **Umbral:** 44px primario (PWA iOS), piso 24px WCAG AA solo secundario. 23 targets con `min-h/min-w-[44px]` (calendario, flechas, tabs, filtros, X modales, season options).
- **Piso tipográfico:** 0 restos `text-[9/10px]` sin variante `sm:` (todo con `text-[11px] sm:text-[...]`).
- **Hero 360px:** `BroadcastScore` con `max-sm:gap-3`, `max-sm:max-w-[96px]`, nombres `line-clamp-2 break-words` (desktop intacto vía `sm:`).
- **Grids densos:** `TransfersTab` p-3/gap-2 en mobile; stats grids con `px-2 + truncate + max-sm:text-[11px]` en centro.
- **Modales:** calendario unificado al patrón `TrendDetailModal` (X 44px + Escape + `useFocusTrap` + `body overflow hidden` + `max-h-[85dvh]`); dropdowns con `dvh` + `max-w-[calc(100vw-2rem)]`.
- **Matriz:** 360/375/390/430 + iPad 768/834/1024 portrait/landscape + regresión desktop 1440; `typecheck` limpio, `lint` 0 errores, `vitest` 153 passed, `vite build` OK.
