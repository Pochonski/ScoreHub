# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** ScoreHub
**Generated:** 2026-09-27
**Category:** Sports Live Scores / Entertainment
**Decision (usuario):** Mantener tema oscuro existente (dark OLED deportivo), NO adoptar sistema claro vibrante. El output Vibrant del CLI queda descartado; este Master lo sobrescribe con tokens reales de `dashboard/src/presentation/styles/globals.css` + estilo verificado `dark-mode-oled`.

---

## Global Rules

### Color Palette — Dark OLED ScoreHub (real, verificado en globals.css)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background base | `#070B15` | `--color-bg-base` |
| Card | `#111B2E` | `--color-bg-card` |
| Elevated | `#1A2642` | `--color-bg-elevated` |
| Accent gold (CTA/resultados) | `#F5A623` | `--color-accent-gold` |
| Accent blue (links/foco/bordes) | `#38BDF8` | `--color-accent-blue` |
| Live | `#22C55E` | `--color-accent-live` |
| Destructive | `#EF4444` | `--color-accent-red` |
| Text primary | `#F1F5F9` | `--color-text-primary` |
| Text muted | `#8899AA` | `--color-text-muted` |
| Text dim | `#7888A0` | `--color-text-dim` |
| Border card | `rgba(56,189,248,0.08)` | `--color-border-card` |
| Border hover | `rgba(56,189,248,0.20)` | `--color-border-hover` |
| Focus ring | `#38BDF8` | `--color-ring` |

**Color Notes:** Estilo verificado `dark-mode-oled` (Deep Black/Midnight Blue + neón, cost:low, risk:low|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion). Light mode NOT recomendado para este producto. Contraste: `text-dim #7888A0` ~4.6:1 sobre card (AA OK, era #64748b 3.62:1 y se subió). No usar `#DC2626/#FEF2F2` del output genérico.

### Typography — real del producto (NO Bebas/Source genéricos)

- **Display Font:** Teko (`--font-display`) — marcadores/títulos deportivos
- **Body Font:** Sora (`--font-body`)
- **Mono Font:** JetBrains Mono (`--font-mono`) — minutos, cuotas, stats
- **Reglas móvil (globals.css):** piso `text-[11px]` en teléfonos, nada debajo; `text-[10px]/[9px]` solo en `sm+` o decorativo; inputs `font-size >= 16px` para evitar zoom iOS.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons — oscuro ScoreHub

```css
/* Primary Button (gold sobre base oscura) */
.btn-primary {
  background: #F5A623;
  color: #070B15;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: opacity 200ms ease, transform 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #38BDF8;
  border: 2px solid #38BDF8;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: border-color 200ms ease, opacity 200ms ease;
  cursor: pointer;
}
```

### Cards — oscuro

```css
.card {
  background: #111B2E;
  border: 1px solid rgba(56, 189, 248, 0.08);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  border-color: rgba(56, 189, 248, 0.2);
  transform: translateY(-2px);
}
```

### Inputs — oscuro

```css
.input {
  padding: 12px 16px;
  background: #111B2E;
  color: #F1F5F9;
  border: 1px solid rgba(56, 189, 248, 0.08);
  border-radius: 8px;
  font-size: 16px; /* >=16px evita zoom iOS */
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #38BDF8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
}
```

### Modals — oscuro

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal {
  background: #111B2E;
  border: 1px solid rgba(56, 189, 248, 0.08);
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Dark Mode OLED deportivo (verificado `dark-mode-oled` + tokens reales)

**Keywords:** Dark theme, low light, high contrast, midnight blue, eye-friendly, OLED, neon accents (gold/blue/green), live pulse sobrio

**Best For:** Night-mode sports entertainment, live scores, dashboards densos

**Key Effects:** `shimmer` skeleton, `ecg-pulse` live (2s), `score-update` 0.6s, `goal-flash` 0.8s, `fade-in-up` + stagger ≤400ms, hovers 150-300ms sin layout-shift; `prefers-reduced-motion` desactiva todo (ya en globals.css)

### Page Pattern

**Pattern Name:** Dashboard denso + Hero en vivo (no landing Hero-Centric pura)

- **Estrategia:** Hero solo como ticker/partidos en vivo arriba; debajo tabs multi-competición, tablas, bracket, stats, noticias. Densidad alta, gutters adaptativos, `safe-area` iOS, `no-scrollbar` + `scroll-fade` en filtros horizontales.
- **CTA Placement:** Acciones contextuales por card (ver detalle, seguir equipo), no un único CTA de landing.
- **Gráficos:** Tendencia = Line/Area con línea sólida/punteada + etiquetas (no solo color); Streaming en vivo = Canvas + Pausa/Reanudar + valor actual en texto + tabla fallback (verificado `chart` domain).

---

## Anti-Patterns (Do NOT Use)

- ❌ Static content
- ❌ Poor fan engagement

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Phosphor preferido / Heroicons fallback)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Dark mode text contrast 4.5:1 minimum (verificar muted/dim sobre card/elevated)
- [ ] Focus states visible for keyboard navigation (`#38BDF8` 2px)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px + landscape
- [ ] No content hidden behind fixed navbars (`safe-area` iOS)
- [ ] No horizontal scroll on mobile (salvo tickers con `no-scrollbar` + fade)
- [ ] Live badges con `role="status"` atómico, skeleton con `aria-busy` (verificado `ux` domain)
- [ ] Listas React con `key={id}` estable + `memo()` + deps primitivas (verificado `react` domain)
