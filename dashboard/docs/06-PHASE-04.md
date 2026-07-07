# Fase 4 — Polish Premium

## Objetivo

Elevar el dashboard a calidad de producción: animaciones pulidas, live polling, PWA, performance, accesibilidad.

## Entregables

### 4.1 Animaciones Broadcast (refinamiento)

- [ ] **Goal ray effect**: cuando ocurre un gol en un partido en vivo:
  - Línea horizontal animada que cruza el HeroMatch
  - Color dorado con opacidad decreciente
  - Duración: 800ms
  - Solo en el partido destacado (hero)
- [ ] **Score shimmer refinado**:
  - Escala 1.15 → 1.0 con ease-out
  - Text-shadow glow del color del equipo
  - Partículas sutiles (puntos dorados que se disipan)
- [ ] **Live indicator ECG**: animación de pulso continuo mientras el partido está en vivo
- [ ] **Entrada de tarjetas con stagger**: al cargar la página, las MatchCards entran con fade-in + translateY con delay incremental (50ms por card)

### 4.2 Live Polling

- [ ] Refetch automático cada 30s de:
  - `GET /matches/live` (solo si hay partidos en vivo)
  - `GET /matches/featured`
  - `GET /matches/:id/stats` para el partido destacado
- [ ] Indicador visual "Actualizando..." sutil en la esquina superior derecha
- [ ] No refetch si la pestaña no está visible (Page Visibility API)
- [ ] Polling se detiene si no hay partidos en vivo (vuelve a activarse al detectar próximos)

### 4.3 Skeleton Loaders (refinamiento)

- [ ] Skeletons específicos por sección:
  - HeroMatch skeleton: dos círculos grandes + rectángulo central
  - MatchCard skeleton: rectángulo con forma de tarjeta
  - Standings skeleton: filas con anchos variables
  - Stats skeleton: barras de progreso animadas
- [ ] Shimmer animation con gradiente angular (más premium que el lineal)

### 4.4 Performance

- [ ] Code splitting por sección con `React.lazy` + `Suspense`
  - Hero (carga prioritaria, sin lazy)
  - Standings (lazy)
  - Stats (lazy)
  - News (lazy)
  - PlayerSearch (lazy, modal)
- [ ] Imágenes lazy loading con `loading="lazy"`
- [ ] Memoización de componentes pesados con `React.memo` y `useMemo`
- [ ] Bundle analysis con `rollup-plugin-visualizer`

### 4.5 PWA

- [ ] `public/manifest.json` con:
  - Nombre: "Mundialista 2026"
  - Short name: "Mundialista"
  - Theme color: #070B15
  - Background color: #070B15
  - Display: standalone
  - Iconos en múltiples tamaños (192, 512)
- [ ] Service worker básico para cachear assets estáticos
- [ ] Meta tags para Open Graph y Twitter Cards

### 4.6 Accesibilidad

- [ ] Roles ARIA en todas las secciones:
  - `role="region"` con `aria-label` en cada sección
  - `role="status"` en el indicador live
  - `aria-live="polite"` en secciones que se actualizan
- [ ] Skip to main content link
- [ ] Focus trap en modales (PlayerSearch)
- [ ] `prefers-reduced-motion` chequeado en todas las animaciones (vía matchMedia + CSS)
- [ ] Contraste WCAG AA verificado

### 4.7 Responsive refinamiento

- [ ] Hero sticky en mobile (se compacta al scrollear)
- [ ] Tabla de posiciones con scroll horizontal en mobile
- [ ] Match Ticker con indicadores de scroll (flechas laterales en desktop)
- [ ] Prueba en: 320px, 375px, 768px, 1024px, 1440px, 1920px

### 4.8 Componentes de historia y brackets

- [ ] `HistoryTimeline.tsx` — Línea de tiempo de todas las ediciones del Mundial:
  - Cada edición como punto en una línea vertical
  - Al hacer click: muestra final, sede, campeón
  - Scroll vertical
- [ ] `BracketView.tsx` — Vista de llaves de eliminación directa:
  - Árbol de eliminación con partidos
  - Equipos clasificados resaltados
  - Solo visible en fase eliminatoria

## Criterios de aceptación

- [ ] Animaciones solo se activan con `prefers-reduced-motion: no-preference`
- [ ] Live polling no hace requests si la pestaña no está visible
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse PWA ≥ 80 (si es aplicable)
- [ ] Sin layout shift durante carga (CLS ≤ 0.1)
- [ ] Bundle total < 200KB (gzip)
- [ ] Sin errores en consola
- [ ] Focus visible en todos los interactivos
- [ ] Funciona sin JavaScript (server-side fallback básico, opcional)

## Checklist final de despliegue

- [ ] Variables de entorno configuradas en Azure App Service
- [ ] CORS configurado para el dominio del dashboard
- [ ] Cosmos DB connection string en variables de entorno
- [ ] Nginx/Azure static config para SPA routing
- [ ] HTTPS forzado
- [ ] Cache headers configurados en Express
- [ ] Logging de errores
- [ ] Backup de docs de Cosmos DB
