# Fase 2 — Core: Partidos + Tabla + Héroe

## Objetivo

Implementar la experiencia principal del dashboard: partidos en vivo con héroe animado, cuadrícula de partidos filtrable, y tabla de posiciones completa.

## Entregables

### 2.1 Hero Match

- [ ] `HeroMatch.tsx` — Tarjeta expandida del partido destacado:
  - Escudos grandes de equipos con `TeamBadge`
  - Marcador en Teko Bold (clamp 56px–96px)
  - Indicador LIVE con animación de pulso ECG (solo si status=live)
  - Timeline de eventos (goles, tarjetas) si hay datos
  - Stats rápidas: posesión, tiros, corners (desde `match/:id/stats`)
  - Animación broadcast: el score tiembla al actualizarse
- [ ] `BroadcastScore.tsx` — Componente de score animado:
  - Recibe el score actual y el anterior
  - Si cambió: animación de shimmer dorado + vibración breve
  - Si no cambió: render estático

### 2.2 Match Ticker

- [ ] `MatchTicker.tsx` — Strip horizontal con scroll nativo:
  - Tarjetas compactas de todos los partidos (80px × 100px)
  - Orden: live primero, luego por hora
  - La tarjeta del hero se marca como activa
  - Scroll horizontal con overflow-x-auto
  - Click en una tarjeta la promociona a hero

### 2.3 Match Grid

- [ ] `MatchCard.tsx` — Tarjeta de partido:
  - Escudos, nombres, marcador, estado
  - Badge de estado (EN VIVO, FINAL, 14:30)
  - Indicador de etapa (Fase de grupos, Octavos, etc.)
  - Hover: leve elevación + glow azul cielo
- [ ] `MatchGrid.tsx` — Grid responsive:
  - Desktop: 3-4 columnas
  - Tablet: 2 columnas
  - Mobile: 1 columna
  - Agrupado por fecha/estado
- [ ] `MatchFilterBar.tsx` — Filtros:
  - Botones: Todos, EN VIVO, Próximos, Finalizados
  - Selector de fecha (hoy, ayer, mañana, personalizado)
  - Badge con contador de partidos en vivo

### 2.4 Group Standings

- [ ] `GroupStandings.tsx` — Tabla de posiciones:
  - Columnas: #, Equipo (con escudo), PJ, G, E, P, GF, GC, DG, PTS, Últimos 5
  - Forma reciente con `FormDot` (verde = W, amarillo = D, rojo = L)
  - Highlight en el equipo del usuario (si sigue alguno)
  - Responsive: en mobile oculta columnas secundarias (GF, GC, DG)

### 2.5 Endpoints adicionales

| Endpoint | Estado |
|----------|--------|
| `GET /api/football/matches/:id/timeline` | ✅ Nuevo |
| `GET /api/football/brackets` | ✅ Nuevo |
| `GET /api/football/matches/:id/pre-stats` | ✅ Nuevo |

### 2.6 Hooks nuevos

- [ ] `useFeaturedGame` — Lógica del smart pick + refetch periódico
- [ ] `useMatchTips` — Tips para un partido específico
- [ ] `useTrends` — Tendencias del Mundial

## Animaciones clave (broadcast)

### Score shimmer
```
1. Detectar cambio en score (homeScore o awayScore)
2. Si cambió:
   a. Aplicar clase .score-update con duración 600ms
   b. Scale(1.1 → 1.0) + gold text-shadow glow
   c. Si es gol del equipo local: rayo de izquierda a derecha
   d. Si es gol del visitante: rayo de derecha a izquierda
3. Remover clase después de la animación
```

### Live indicator (ECG pulse)
```
@keyframes ecg-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
  50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
}
```

### Sticky hero en mobile
```
@media (max-width: 768px) {
  .hero-match {
    position: sticky;
    top: 56px; /* altura de navbar */
    z-index: 10;
    transition: all 0.3s ease;
  }
  .hero-match.compact {
    padding: 8px 16px;
    border-radius: 0;
    /* Score se reduce, escudos se achican */
  }
}
```

## Criterios de aceptación

- [ ] Hero muestra el partido correcto según prioridad (live > próximo > último)
- [ ] Timeline de eventos se ve cuando hay datos del partido destacado
- [ ] Match Ticker scrollea horizontalmente sin barras nativas visibles
- [ ] Click en tarjeta del ticker cambia el hero
- [ ] Match Grid filtra correctamente por estado
- [ ] Tabla de posiciones muestra datos reales (con fallback si Cosmos está vacío)
- [ ] Animación de gol funciona en live (score shimmer + rayo)
- [ ] Responsive: mobile no rompe el layout
- [ ] Skeleton loaders en todas las secciones mientras cargan
- [ ] `prefers-reduced-motion` desactiva todas las animaciones
