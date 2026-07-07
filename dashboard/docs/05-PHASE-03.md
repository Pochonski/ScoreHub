# Fase 3 — Stats, Tips, Noticias, Jugadores

## Objetivo

Completar el dashboard con estadísticas del torneo, tendencias de apuestas, noticias, exploración de jugadores y equipos.

## Entregables

### 3.1 Stats Panel

- [ ] `TopScorers.tsx` — Tabla de goleadores:
  - Foto del jugador (TeamBadge circular), nombre, equipo, goles
  - Barra de progreso horizontal proporcional al líder
  - Top 10
- [ ] `Assists.tsx` — Tabla de asistencias (mismo formato)
- [ ] `Ratings.tsx` — Tabla de valoraciones (mismo formato)
- [ ] Las tres tablas en un grid de 3 columnas (desktop), 1 columna (mobile)
  - Título "🏆 Estadísticas del Torneo"
- [ ] `TeamOfWeek.tsx` — Once ideal de la jornada:
  - Formación (4-4-2, 4-3-3, etc.) con jugadores posicionados
  - Rating de cada jugador
  - Solo visible si hay datos

### 3.2 Betting Tips & Trends

- [ ] `BettingTrends.tsx` — Tendencias del Mundial:
  - Lista de top tendencias con barra de confianza (`ConfidenceBar`)
  - Etiqueta del tipo (Ganador, Over/Under, Ambos marcan, etc.)
  - Emoji indicador de fuerza (🔥 ≥75%, 📈 ≥60%, ➖ ≥50%, 📉 <50%)
  - Disclaimer: "Las tendencias se actualizan cada 30 minutos"
- [ ] `MatchTips.tsx` — Tips por partido (en el detalle):
  - Score de confianza general
  - Top 5 tendencias del partido
  - Botón "Ver todas las tendencias"

### 3.3 News Feed

- [ ] `NewsFeed.tsx` — Feed de noticias:
  - Grid de tarjetas (3 desktop, 2 tablet, 1 mobile)
  - Carga más al hacer scroll infinito
- [ ] `NewsCard.tsx` — Tarjeta de noticia:
  - Imagen de la noticia (con fallback si no hay)
  - Fecha (formato relativo: "hace 2 horas")
  - Título en Sora Medium
  - Click → abre la URL en nueva pestaña

### 3.4 Player & Team Explorer

- [ ] `PlayerSearch.tsx` — Búsqueda de jugadores:
  - Input de búsqueda con debounce (300ms)
  - Resultados en dropdown con foto, nombre, equipo, posición
  - Navegación por teclado (arrow keys + enter)
- [ ] `PlayerProfile.tsx` — Perfil de jugador:
  - Foto grande, nombre, edad, posición, equipo nacional
  - Bio corta
  - Estadísticas de carrera (si hay datos de `athlete_careers`)
  - Trofeos agrupados por categoría (si hay datos d athlete_trophies)
  - Transferencias recientes
- [ ] `TeamCard.tsx` — Tarjeta de equipo:
  - Escudo grande, nombre, país
  - Récord en el torneo (partidos jugados, ganados, etc.)
  - Próximo partido

### 3.5 Endpoints adicionales

| Endpoint | Estado |
|----------|--------|
| `GET /api/football/stats/scorers` | ✅ |
| `GET /api/football/stats/assists` | ✅ |
| `GET /api/football/stats/ratings` | ✅ |
| `GET /api/football/stats/team-of-week` | ✅ |
| `GET /api/football/trends` | ✅ |
| `GET /api/football/athletes` | ✅ |
| `GET /api/football/athletes/:id` | ✅ |
| `GET /api/football/athletes/:id/career` | ✅ |
| `GET /api/football/athletes/:id/trophies` | ✅ |
| `GET /api/football/athletes/:id/transfers` | ✅ |
| `GET /api/football/teams/:id/matches` | ✅ |
| `GET /api/football/matches/:id/tips` | ✅ |
| `GET /api/football/matches/:id/trends` | ✅ |
| `GET /api/football/matches/:id/predictions` | ✅ |
| `GET /api/football/countries` | ✅ |
| `GET /api/football/tournament-info` | ✅ |

### 3.6 Hooks nuevos

- [ ] `useTournamentStats` — Goleadores, asistencias, ratings
- [ ] `useTrends` — Tendencias del Mundial
- [ ] `useMatchTips` — Tips de un partido
- [ ] `useAthletes` — Búsqueda y perfil
- [ ] `useTeams` — Equipos
- [ ] `useHistory` — Ediciones históricas

### 3.7 UI Components nuevos

- [ ] `ConfidenceBar.tsx` — Barra de porcentaje con gradiente
- [ ] `FormDot.tsx` — Punto de forma reciente (W/D/L)
- [ ] `TeamBadge.tsx` — Escudo con fallback (letra inicial si no hay imagen)

## Criterios de aceptación

- [ ] TopScorers muestra datos reales desde Cosmos
- [ ] BettingTrends muestra tendencias sin duplicados
- [ ] NewsFeed carga más noticias al scrollear
- [ ] PlayerSearch busca con debounce y navegación por teclado
- [ ] PlayerProfile carga datos anidados (career, trophies, transfers)
- [ ] Todos los skeletons funcionan durante carga
- [ ] Sin errores en consola
- [ ] TypeScript compila sin errores (tsc --noEmit)
