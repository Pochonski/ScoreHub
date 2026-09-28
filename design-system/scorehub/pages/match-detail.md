# Match Detail Page Overrides — ScoreHub (oscuro denso)

> **PROJECT:** ScoreHub
> **Page:** match-detail (`MatchDetailPage.tsx` + `match-detail/*`)
> Reglas aquí **sobrescriben** `MASTER.md`. Lo no listado usa Master.

---

## Desviaciones verificadas

### Layout
- Cabecera `MatchHeader` + `MatchScoreCard` (hero compacto, mismo patrón `BroadcastScore` que dashboard).
- Secciones: `MatchTimeline` (eventos), `MatchStatsTable` (comparativa), `MatchLineups`, `MatchPredictions` + `MatchTips`, `MatchNews`, `MatchSuggestions`.
- Sticky/fijo: verificar que ningún overlay persistente oculte el foco (verificado `ux: Focus Not Obscured Minimum AA` → `scroll-padding-top: var(--header-height)`; Enhanced AAA solo si se apunta a AAA).

### Charts (verificado `chart: Trend Over Time / Real-Time Streaming / Anomaly`)
- `MatchStatsTable` y `BettingTrends`: comparar con barras/líneas usando color + estilo de línea/etiqueta (no solo tono). Series múltiples: colores distintos + `solid/dashed/dotted` + labels directos.
- Streaming en vivo (minuto a minuto): si se añade gráfico, Canvas + buffer 60-300s + botón Pausa/Reanudar + valor actual en texto + tabla fallback + teclado (foco revela valores, +/- zoom, Reset). Sin parpadeo sin soporte reduced-motion.

### Forms/errores (verificado `ux: Focusable Error Summary`, `Error Messages`)
- `MatchTips` / filtros con validación: errores inline por campo + resumen al tope del form con `role=alert tabindex=-1`, foco al heading tras submit fallido, cada ítem enlaza a su campo (`<a href="#email>`). Errores con `aria-live`/`role=alert`, nunca solo borde rojo.

### Web/app-interface (verificado `web: Safe Area Insets`, `Touch Spacing`)
- Respetar `safe-area-inset` en headers/CTA fijos (ya existe `.safe-area-bottom/top`); nada tappable bajo notch/gesture bar.
- Targets adyacentes con `gap ≥8dp`; BottomNav ya en `min-h-[48px]`.

### Iconos/motion/tipo
- Igual que dashboard: Phosphor verificado (`Bell`, `ArrowLeft`, `Compass`); queries deportivas sin match → general + Heroicons fallback.
- Motion: solo CSS (`score-animate`, `goal-ray`); GSAP Subtle solo si se instala algún día.
- Tipo: Teko/Sora/JetBrains Mono; piso móvil 11px.
