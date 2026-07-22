# API de 365scores — Endpoints usados

**Base URL:** `https://webws.365scores.com/web/`

**Headers comunes:**
- `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0`
- `Accept-Encoding: gzip, deflate, br`
- `Origin: https://www.365scores.com`
- `Referer: https://www.365scores.com/`
- `Accept-Language: es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7,...`

**Parámetros comunes:**
- `appTypeId=5` (web)
- `langId=14` (español)
- `timezoneName=America/Costa_Rica`
- `userCountryId=153`

**Comportamiento clave:**
- 365scores cachea respuestas con `Cache-Control: public, max-age=15` (15 segundos)
- 365scores NO requiere API key (es público, solo headers de navegador)
- CORS abierto (`access-control-allow-origin: *`) — se puede llamar desde cualquier origen
- Throttling implícito: si haces >10 req/s puede rate-limitarte
- Compresión gzip soportada — el cliente usa `Accept-Encoding: gzip, deflate, br` y descomprime con `zlib.gunzipSync`

---

## 1. Catálogo

### `GET /sports/`
- **Servicio:** `api.getSports()`
- **Param extra:** ninguno
- **Devuelve:** `sports[]`, `countries[]`, `competitions[]` (cross-league)
- **Cache Cosmos:** N/A (solo se usa para descubrir el mundial)
- **Uso en bot:** durante bootstrap, parsea `countries` y `competitions`

### `GET /competitions/featured/`
- **Servicio:** `api.getCompetitionsFeatured(1)`
- **Param extra:** `sports=1&withSeasons=true`
- **Devuelve:** `competitions[]` con `id, name, nameForURL, countryId, currentSeasonNum, imageVersion`
- **Cache Cosmos:** `catalog` (entityType=`competitions`)
- **Uso en bot:** descubrir Mundial 2026 (id=5930, name="Mundial")

### `GET /competitions/`
- **Servicio:** `api.getCompetition(5930)`
- **Param extra:** `competitions=5930&withSeasons=true&withBestOdds=true&isDashboard=true`
- **Devuelve:** detalle del Mundial, seasons array
- **Cache Cosmos:** `catalog` (entityType=`competitions-detail`)
- **Uso en bot:** info del Mundial, fechas, fases

### `GET /relatedEntities/`
- **Servicio:** `api.getRelatedEntities(5930)`
- **Devuelve:** `sports[]`, `countries[]`, `competitions[]` (ligados al mundial)
- **Cache Cosmos:** `catalog` (entityType=`relatedEntities`)
- **Uso en bot:** descubrir sub-competiciones (Mundial Sub-20, etc.)

### `GET /competitors/top/`
- **Servicio:** `api.getTopCompetitors(60)`
- **Param extra:** `limit=60&promoteNational=true&withSeasons=true&isDashboard=true`
- **Devuelve:** 60 competidores top (selecciones nacionales primero)
- **Cache Cosmos:** `catalog` (entityType=`competitors`)
- **Uso en bot:** descubrir 48 selecciones del Mundial + 12 equipos más

---

## 2. Partidos

### `GET /games/allscores/`
- **Servicio:** `api.getGamesAllScores(startDate, endDate, sports, opts)`
- **Params:** `sports=1&startDate=DD/MM/YYYY&endDate=DD/MM/YYYY&showOdds=true&onlyMajorGames=true&withTop=true`
- **Devuelve:** `games[]` de la fecha con todos los detalles
- **Cache Cosmos:** `games` (filtrado por `competitionId=5930`)
- **Uso en bot:** bootstrap hace chunks de 7 días para evitar rate-limit, junta ~87 partidos

### `GET /games/featured/`
- **Servicio:** `api.getGamesFeatured(sports, numberOfGames)`
- **Params:** `sports=1&showOdds=true&numberOfGames=4&context=1`
- **Devuelve:** 4 partidos destacados
- **Cache Cosmos:** N/A (solo en el bot)
- **Uso en bot:** /partidos cuando no hay Mundial hoy

### `GET /games/current/`
- **Servicio:** `api.getGamesCurrent(5930)`
- **Params:** `competitions=5930&showOdds=true&includeTopBettingOpportunity=1`
- **Devuelve:** `games[]` actualmente en vivo o próximos
- **Cache Cosmos:** N/A (consulta en tiempo real)
- **Uso en bot:** `liveGamesPoller` filtra `statusGroup=1` (En vivo) para hacer polling

### `GET /games/results/`
- **Servicio:** `api.getGamesResults(5930)`
- **Params:** `competitions=5930&showOdds=true&includeTopBettingOpportunity=1`
- **Devuelve:** resultados recientes del Mundial
- **Cache Cosmos:** N/A
- **Uso en bot:** (no usado activamente)

### `GET /games/fixtures/`
- **Servicio:** `api.getFixtures(5930)`
- **Params:** `competitions=5930&showOdds=true&includeTopBettingOpportunity=1`
- **Devuelve:** partidos próximos (fixtures) del Mundial
- **Cache Cosmos:** N/A
- **Uso en bot:** (no usado activamente)

### `GET /games/h2h/`
- **Servicio:** `api.getGameH2H(gameId, matchupId, addMainOdds)`
- **Params:** `gameId={id}&matchupId={homeId}-{awayId}-5930&addMainOdds=true`
- **Devuelve:** `game` con `homeCompetitor.lineups.members[]` (27 titulares), `recentMatches[]`, `h2hGames[]` (8 partidos anteriores)
- **Cache Cosmos:** `game_h2h` (partition `/gameId`)
- **Uso en bot:** 87 docs, contiene los squads de cada partido

### `GET /game/`
- **Servicio:** `api.getGameOverview(gameId, matchupId)`
- **Params:** `gameId={id}&matchupId={homeId}-{awayId}-5930`
- **Devuelve:** `game` con `homeCompetitor.lineups.members[]`, `awayCompetitor.lineups.members[]`, `members[]` (54 totales)
- **Cache Cosmos:** `game_overviews` (partition `/gameId`)
- **Uso en bot:** contiene los lineups detallados, posiciones, formación

### `GET /game/stats/`
- **Servicio:** `api.getGameStats(gameId, lastUpdateId)`
- **Params:** `games={id}` (opcional `&lastUpdateId={id}` para delta)
- **Devuelve:** `statistics[]` (30+ stats), `statisticsFilters[]` (Partido/1T/2T)
- **Cache Cosmos:** `game_snapshots` (partition `/gameId`, TTL 90d)
- **Uso en bot:** `liveGamesPoller` cada 25s, persiste deltas con `lastUpdateId`
- **TTL response:** 10s (cached for 10s by 365scores itself)

---

## 3. Stats y rankings

### `GET /stats/preGame/`
- **Servicio:** `api.getGamePreStats(gameId)`
- **Params:** `game={id}&onlyMajor=true`
- **Devuelve:** `statistics[]` pre-partido (forma reciente, lesiones, etc.)
- **Cache Cosmos:** `game_pre_stats` (partition `/gameId`)
- **Uso en bot:** solo para partidos `statusGroup=2` (Programados)

### `GET /tournament/`
- **Servicio:** `api.getTournamentStats(competitionId, seasonNum, competitors)`
- **Params:** `competitions={id}{?seasonNum}{?competitors}&withSeasons=true`
- **Devuelve:** `stats` con keys `0..N` (uno por ranking: goleadores, asistidores, tarjetas, etc.)
- **Cache Cosmos:** `tournament_stats` (partition `/competitionId`)
- **Uso en bot:** `tournament_stats.athletesStats` (16 jugadores) y `tournament_stats.competitorsStats` (9 equipos)

### `GET /standings/`
- **Servicio:** `api.getStandings(competitionId, stageNum, seasonNum)`
- **Params:** `competitions={id}&live=false&isPreview=true&stageNum=1&seasonNum=25`
- **Devuelve:** `standings[].rows[]` con `competitor`, `points`, `gamesWon`, `gamesEven`, `gamesLost`, `goalsFor`, `goalsAgainst`, `ratio`, `recentForm[]`
- **Cache Cosmos:** `standings` (partition `/competitionId`)
- **Uso en bot:** tabla de posiciones, fase de grupos

### `GET /brackets/`
- **Servicio:** `api.getBrackets(competitionId)`
- **Params:** `competitions={id}&live=false`
- **Devuelve:** `brackets[].stages[].groups[]` (12 grupos en fase 1, 16avos en fase 2, etc.)
- **Cache Cosmos:** `brackets` (partition `/competitionId`)
- **Uso en bot:** estructura completa del Mundial, a dónde clasifica cada equipo

### `GET /competitions/teamoftheweek/`
- **Servicio:** `api.getTeamOfWeek(competitionId)`
- **Devuelve:** `teamOfWeek.lineup.members[]` con formation 4-4-2, ratings por jugador
- **Cache Cosmos:** `highlights` (partition `/kind`)
- **Uso en bot:** /equipoideal

### `GET /competitions/history/`
- **Servicio:** `api.getCompetitionHistory(5930)`
- **Devuelve:** `table.rows[]` con cada edición del Mundial (22 ediciones, 1930-2022)
- **Cache Cosmos:** `competition_history` (partition `/competitionId`)
- **Uso en bot:** /historial, "Final 2022 Argentina-Francia en Lusail"

---

## 4. Predicciones y odds

### `GET /games/predictions/`
- **Servicio:** `api.getPredictions(sports, competitors)`
- **Params:** `sports=1{?competitors=...}`
- **Devuelve:** `games[].promotedPredictions.predictions[]` con totalVotes, options[]
- **Cache Cosmos:** `predictions` (partition `/gameId`, TTL 7d)
- **Uso en bot:** predicciones de la comunidad para los partidos

### `GET /bets/lines/`
- **Servicio:** `api.getOddsLines(gameId)`
- **Params:** `games={id}`
- **Devuelve:** cuotas de apuestas del partido
- **Cache Cosmos:** `odds_lines` (partition `/gameId`, TTL 2h) — **reemplazado por odds_misc**
- **Uso en bot:** (no usado activamente)

### `GET /bets/outrights/`
- **Servicio:** `api.getOutrights(competitionId)`
- **Params:** `competition={id}&sport=1`
- **Devuelve:** apuestas outright (ganador del Mundial, máximo goleador, etc.)
- **Cache Cosmos:** `odds_misc` (partition `/kind`, TTL 6h)
- **Uso en bot:** (no usado activamente)

### `GET /bets/lines/bestodds/`
- **Servicio:** `api.getBestOdds(competitionId, sport, minGames, maxGames)`
- **Devuelve:** mejores cuotas agregadas
- **Cache Cosmos:** `odds_misc` (partition `/kind`)
- **Uso en bot:** (no usado activamente)

### `GET /bets/teaser/`
- **Servicio:** `api.getTeaserBets(gameId)`
- **Devuelve:** apuestas teaser (combinadas mejoradas)
- **Cache Cosmos:** N/A
- **Uso en bot:** (no usado)

---

## 5. Tendencias (lo más importante para tips)

### `GET /trends/`
- **Servicio:** `api.getTrends(scope, id)`
- **Params según scope:**
  - `games={id}` (per-game) → tendencias específicas del partido
  - `competition={id}&isTop=true` (comp) → tendencias top del Mundial
  - `sportType=1&date=DD/MM/YYYY&isTop=true` (sport) → top diario
- **Devuelve:** `trends[]` con `text`, `percentage` (0-1), `betCTA` (call-to-action), `lineTypeId` (1=winner, 3=O/U, 7=first goal, 12=BTTS, 14=double chance), `competitorIds[]`, `confidenceTrendIds[]`
- **Cache Cosmos:** `trends` (partition `/scope`)
- **Uso en bot:** 594 per-game trends + 44 competition trends = 638 total
- **Ejemplo:** `Ambos equipos marcaron - 7/9 Últimos partidos` (78%) → `betCTA: Ambos equipos marcarán`

---

## 6. Atletas

### `GET /athletes/`
- **Servicio:** `api.getAthlete(athleteId, fullDetails)`
- **Params:** `athletes={id}{&fullDetails=true}`
- **Devuelve:** perfil completo: `trophies.categories[]`, `transfers[]`, `careerStats.seasons[]`, `nationalTeamStatsText`
- **Cache Supabase:** tabla `athletes` (PK canónico `id`; columna generada `canonical_id`)
- **Cache-on-read:** el endpoint `/api/football/athletes/:id` rehidrata desde este upstream si la fila está vacía o es más vieja que `ATHLETE_STALE_AFTER_MS` (default 24 h)
- **Sync:** `syncAthletes()` recorre `game_lineups` (no `game_overviews`) y para cada `athleteId` canónico llama a este endpoint y upserts el JSON completo
- **Uso en dashboard:** `https://<host>/player/:id` con `:id` = id canónico (Mbappé = 39820)

### `GET /athletes/nextGame/`
- **Servicio:** `api.getAthleteNextGame(athleteId)`
- **Devuelve:** próximo partido del atleta
- **Cache Cosmos:** `athlete_next_games` (partition `/athleteId`, TTL 7d) — *legacy, no migrado a Supabase*
- **Uso en bot:** lazy load

### `GET /athletes/games/`
- **Servicio:** `api.getAthleteGames(athleteId)`
- **Devuelve:** historial de partidos del atleta con `athleteStats[]` (rendimiento por partido)
- **Cache Cosmos:** `athlete_games` (partition `/athleteId`) — *legacy, no migrado a Supabase*
- **Uso en bot:** lazy load

### `GET /athletes/chartEvents/`
- **Servicio:** `api.getAthleteChartEvents(athleteId)`
- **Devuelve:** `chartEvents[]` con `xg`, `xgot`, `bodyPart`, `goalDescription`, `coordinates` (line/side/y/z), `gameId`
- **Cache Cosmos:** `athlete_chart_events` (partition `/athleteId`) — *legacy, no migrado a Supabase*
- **Uso en bot:** 33 atletas con shot map (lazy load)

---

## 7. Contenido

### `GET /news/`
- **Servicio:** `api.getNews(scope, id)`
- **Params según scope:**
  - `sports=1&isPreview=true` → preview news
  - `competitions={id}&isPreview=false` → Mundial news
  - `games={id}&isPreview=true|false` → game news
  - `athletes={id}&isPreview=true|false` → athlete news
- **Devuelve:** `news[]` con `id, title, publishDate, image, url, sourceId`, `newsSources[]` con `id, name`
- **Cache Cosmos:** `news` (partition `/scope`, TTL 30d)
- **Uso en bot:** 141 noticias del Mundial. Titles incluyen: "Historial de...", "Alineación probable...", "Probable XI de..."

---

## Resumen de uso por handler

| Bot handler | Endpoint 365scores |
|---|---|
| `/partidos` | `games/allscores/` o `games/featured/` |
| `/tabla` o `/mundial` | `standings/` |
| `/mundial` estructura | `brackets/` |
| `/racha` | `games/results/` |
| `/historial` | `competitions/history/` |
| `/equipoideal` | `competitions/teamoftheweek/` |
| `/goleador` o `/goles` | `tournament/?competitors=...` (athletesStats) |
| `/seguir partido` | `liveGamesPoller` → `game/stats/` cada 25s |
| Notificaciones live | `game/stats/?lastUpdateId=...` (delta) |
| User-driven `/follow` | lee `bet_followers` + evalúa con `game_snapshots` |

---

## Rate limits y buenas prácticas

- **Sin rate limit explícito** documentado, pero empíricamente ~5-10 req/s sin throttling
- **Cache-Control: max-age=15** en respuestas → no tiene sentido polleear más rápido que eso
- **El `liveGamesPoller` está configurado a 25s** (SCORES365_POLL_MS)
- **El `cosmosRefresh` corre cada 6h** (no cada minuto)
- **El bootstrap divide las fechas en chunks de 7 días** para evitar respuestas gigantes
- **El cliente HTTP** (`scores365Service.js`) implementa:
  - Throttling mínimo de 80ms entre llamadas
  - Retry con backoff exponencial en 429/5xx
  - Gzip automático vía `Accept-Encoding` + `zlib.gunzipSync`
  - User-Agent realista (Edge 149) para evitar bloqueos
