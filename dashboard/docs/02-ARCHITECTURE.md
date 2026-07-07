# 02 — Arquitectura

## Clean Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  React Components · Pages · Hooks · Tailwind Styles     │
│                                                         │
│  Depende de: Domain (interfaces, types)                 │
│  Inyecta: Data repositories vía hooks                   │
├─────────────────────────────────────────────────────────┤
│                      DATA LAYER                         │
│  Repositories (implementaciones) · Mappers · ApiClient  │
│                                                         │
│  Depende de: Domain (repositories interfaces)           │
│  Inyecta: Infrastructure HTTP                           │
├─────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                        │
│  Entities (interfaces/types) · Repository interfaces    │
│                                                         │
│  Sin dependencias externas (pure TypeScript)            │
├─────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                   │
│  HttpClient · Config (API_BASE_URL, CDN_BASE)           │
├─────────────────────────────────────────────────────────┤
│                   EXPRESS API LAYER                      │
│  Routes → Controllers → Cosmos DB + CDN enrichment      │
│  (Servidor separado, deploy en dominio propio)          │
└─────────────────────────────────────────────────────────┘
```

## Estructura de archivos

```
dashboard/
├── docs/                            # Documentación del proyecto
│   ├── 00-VISION.md
│   ├── 01-DESIGN-TOKENS.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-PHASE-01.md
│   ├── 04-PHASE-02.md
│   ├── 05-PHASE-03.md
│   └── 06-PHASE-04.md
│
├── server/                          # Express API (dominio separado)
│   ├── package.json                 # Dependencias: express, @azure/cosmos, dotenv
│   ├── index.js                     # Entry point: Express app, CORS, static serve
│   ├── routes/
│   │   └── football.js              # Router con todos los endpoints /api/football/*
│   └── controllers/
│       └── footballController.js    # Lógica: Cosmos queries + CDN enrichment
│
├── src/                             # React app (Clean Architecture)
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Game.ts              # Partido
│   │   │   ├── Team.ts              # Equipo/competidor
│   │   │   ├── Athlete.ts           # Jugador
│   │   │   ├── Standing.ts          # Fila de tabla
│   │   │   ├── StandingGroup.ts     # Grupo de tabla
│   │   │   ├── TournamentStat.ts    # Estadística de torneo
│   │   │   ├── News.ts              # Noticia
│   │   │   ├── BettingTip.ts        # Tip de apuesta
│   │   │   ├── Trend.ts             # Tendencia
│   │   │   ├── Prediction.ts        # Predicción comunidad
│   │   │   ├── MatchEvent.ts        # Evento de partido (gol, tarjeta, etc)
│   │   │   ├── Lineup.ts            # Alineación con miembros
│   │   │   ├── HistoryEdition.ts    # Edición histórica del Mundial
│   │   │   └── Bracket.ts           # Estructura de llaves
│   │   └── repositories/
│   │       ├── GameRepository.ts
│   │       ├── StandingRepository.ts
│   │       ├── AthleteRepository.ts
│   │       ├── NewsRepository.ts
│   │       ├── BettingTipRepository.ts
│   │       ├── TrendRepository.ts
│   │       ├── PredictionRepository.ts
│   │       ├── TeamRepository.ts
│   │       ├── HistoryRepository.ts
│   │       └── BracketRepository.ts
│   │
│   ├── data/
│   │   ├── repositories/            # Implementaciones concretas
│   │   │   ├── ApiGameRepository.ts
│   │   │   ├── ApiStandingRepository.ts
│   │   │   ├── ApiAthleteRepository.ts
│   │   │   ├── ApiNewsRepository.ts
│   │   │   ├── ApiBettingTipRepository.ts
│   │   │   ├── ApiTrendRepository.ts
│   │   │   ├── ApiPredictionRepository.ts
│   │   │   ├── ApiTeamRepository.ts
│   │   │   ├── ApiHistoryRepository.ts
│   │   │   └── ApiBracketRepository.ts
│   │   ├── datasources/
│   │   │   └── ApiClient.ts         # Fetch wrapper con tipado, errores, headers
│   │   └── mappers/
│   │       ├── GameMapper.ts        # API response → Game entity
│   │       ├── StandingMapper.ts
│   │       ├── AthleteMapper.ts
│   │       └── ...
│   │
│   ├── presentation/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx       # Barra superior con logo + navegación
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── PageShell.tsx    # Estructura base: navbar + main + responsive grid
│   │   │   ├── hero/
│   │   │   │   ├── HeroMatch.tsx    # Tarjeta expandida del partido destacado
│   │   │   │   └── BroadcastScore.tsx  # Score animado estilo broadcast
│   │   │   ├── matches/
│   │   │   │   ├── MatchCard.tsx    # Tarjeta compacta de partido
│   │   │   │   ├── MatchTicker.tsx  # Strip horizontal de partidos
│   │   │   │   ├── MatchGrid.tsx    # Grid de tarjetas filtrables
│   │   │   │   └── MatchFilterBar.tsx  # Filtros por estado/fecha
│   │   │   ├── standings/
│   │   │   │   └── GroupStandings.tsx   # Tabla de posiciones con forma
│   │   │   ├── stats/
│   │   │   │   ├── TopScorers.tsx
│   │   │   │   ├── Assists.tsx
│   │   │   │   ├── Ratings.tsx
│   │   │   │   └── TeamOfWeek.tsx
│   │   │   ├── tips/
│   │   │   │   ├── BettingTrends.tsx   # Tendencias de competición
│   │   │   │   └── MatchTips.tsx       # Tips por partido
│   │   │   ├── news/
│   │   │   │   ├── NewsFeed.tsx
│   │   │   │   └── NewsCard.tsx
│   │   │   ├── teams/
│   │   │   │   └── TeamCard.tsx
│   │   │   ├── players/
│   │   │   │   ├── PlayerSearch.tsx
│   │   │   │   └── PlayerProfile.tsx
│   │   │   ├── brackets/
│   │   │   │   └── BracketView.tsx
│   │   │   ├── history/
│   │   │   │   └── HistoryTimeline.tsx
│   │   │   └── ui/
│   │   │       ├── TeamBadge.tsx       # Imagen de escudo con fallback
│   │   │       ├── Skeleton.tsx        # Skeleton loader con shimmer
│   │   │       ├── LiveIndicator.tsx   # Punto verde animado + label
│   │   │       ├── Badge.tsx
│   │   │       ├── FormDot.tsx         # Punto de forma reciente (W/D/L)
│   │   │       └── ConfidenceBar.tsx   # Barra de porcentaje para tips
│   │   ├── hooks/
│   │   │   ├── useGames.ts
│   │   │   ├── useFeaturedGame.ts
│   │   │   ├── useStandings.ts
│   │   │   ├── useTournamentStats.ts
│   │   │   ├── useNews.ts
│   │   │   ├── useTrends.ts
│   │   │   ├── useMatchTips.ts
│   │   │   ├── useAthletes.ts
│   │   │   ├── useTeams.ts
│   │   │   └── useHistory.ts
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx    # Página principal compuesta
│   │   └── styles/
│   │       └── globals.css          # CSS custom properties + Tailwind layers
│   │
│   ├── infrastructure/
│   │   ├── http/
│   │   │   └── HttpClient.ts        # fetch wrapper con timeout, retry, error handling
│   │   └── config/
│   │       └── index.ts             # API_BASE_URL, CDN_BASE_URL
│   │
│   ├── App.tsx                      # Entry point: Providers → Router → PageShell
│   └── main.tsx                     # ReactDOM.createRoot
│
├── public/
│   └── favicon.svg
│
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── tsconfig.app.json
```

## Flujo de datos

```
Usuario → React Component → Hook → Repository (interface)
                                         │
                                         ▼
                              ApiRepository (implementation)
                                         │
                                         ▼
                              ApiClient.fetch('/api/football/games')
                                         │
                               (HTTP request)
                                         │
                                         ▼
                              Express API (same domain)
                              Routes → Controllers
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                        Cosmos DB              365scores API
                        (cached data)           (live fallback)
                              │                     │
                              └──────────┬──────────┘
                                         ▼
                              CDN URL enrichment
                              (team badges, athlete photos)
                                         │
                                         ▼
                              JSON Response → React
                              Mapper → Domain Entity
                                         │
                                         ▼
                              Component renders
```

## API — Express Endpoints

| Método | Endpoint | Cosmos Container | Propósito |
|--------|----------|-----------------|-----------|
| GET | `/api/football/health` | — | Status del servidor |
| GET | `/api/football/matches` | `games` | Lista de partidos con filtros |
| GET | `/api/football/matches/live` | `games` | Solo partidos en vivo |
| GET | `/api/football/matches/featured` | `games` | Partido destacado (smart pick) |
| GET | `/api/football/matches/:id` | `games` | Detalle de 1 partido |
| GET | `/api/football/matches/:id/stats` | `game_snapshots` | Stats en vivo |
| GET | `/api/football/matches/:id/h2h` | `game_h2h` | Historial cara a cara |
| GET | `/api/football/matches/:id/lineups` | `game_h2h` | Alineaciones |
| GET | `/api/football/matches/:id/pre-stats` | `game_pre_stats` | Stats pre-partido |
| GET | `/api/football/matches/:id/tips` | `betting_tips` | Tips de apuestas |
| GET | `/api/football/matches/:id/trends` | `trends` | Tendencias del partido |
| GET | `/api/football/matches/:id/predictions` | `predictions` | Predicciones comunidad |
| GET | `/api/football/matches/:id/timeline` | `game_snapshots` | Eventos del partido |
| GET | `/api/football/standings` | `standings` | Tablas de grupos |
| GET | `/api/football/brackets` | `brackets` | Llaves de eliminación |
| GET | `/api/football/history` | `competition_history` | Ediciones históricas |
| GET | `/api/football/stats/scorers` | `tournament_stats` | Goleadores |
| GET | `/api/football/stats/assists` | `tournament_stats` | Asistencias |
| GET | `/api/football/stats/ratings` | `tournament_stats` | Valoraciones |
| GET | `/api/football/stats/team-of-week` | `highlights` | Once ideal |
| GET | `/api/football/trends` | `trends` | Tendencias del Mundial |
| GET | `/api/football/news` | `news` | Últimas noticias |
| GET | `/api/football/news/game/:id` | `news` | Noticias de un partido |
| GET | `/api/football/athletes` | `athletes` | Buscar jugadores |
| GET | `/api/football/athletes/:id` | `athletes` | Perfil de jugador |
| GET | `/api/football/athletes/:id/career` | `athlete_careers` | Carrera por temporadas |
| GET | `/api/football/athletes/:id/trophies` | `athlete_trophies` | Trofeos |
| GET | `/api/football/athletes/:id/transfers` | `athlete_transfers` | Transferencias |
| GET | `/api/football/teams` | `catalog` | Lista de equipos |
| GET | `/api/football/teams/:id` | `catalog` | Detalle de equipo |
| GET | `/api/football/teams/:id/matches` | `games` | Partidos de un equipo |
| GET | `/api/football/countries` | `catalog` | Países |
| GET | `/api/football/tournament-info` | `catalog` | Info del torneo |
