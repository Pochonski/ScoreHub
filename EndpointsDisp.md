# Free API Live Football Data - Endpoints

**Base URL:** `https://free-api-live-football-data.p.rapidapi.com`

**Host:** `free-api-live-football-data.p.rapidapi.com`

**API Key:** Usar variable de entorno `RAPIDAPI_KEY`

---

## ✅ Endpoints Implementados (27)

### 🔍 Búsquedas (4/5)

```
GET /football-all-search?search=texto                    ✅ searchAll()
GET /football-teams-search?search=texto                   ✅ searchTeams()
GET /football-players-search?search=texto                 ✅ searchPlayers()
GET /football-leagues-search?search=texto                 ✅ searchLeagues()
GET /football-matches-search?search=texto                 ❌ (sin uso)
```

### 📅 Liga de Temporadas (1/1)

```
GET /football-league-all-seasons                         ✅ getAllSeasons()
```

### 🌍 Países (1/1)

```
GET /football-get-all-countries                           ✅ getAllCountries()
```

### 📊 Partidos (3/3)

```
GET /football-get-matches-by-date?date=YYYYMMDD           ✅ getMatchesByDate()
GET /football-get-matches-by-date-and-league?date=YYYYMMDD&leagueid=X ✅ getMatchesByDateAndLeague()
GET /football-get-all-matches-by-league?leagueid=X       ✅ getAllMatchesByLeague()
```

### 🏆 Equipos (4/4)

```
GET /football-get-list-home-team?leagueid=X              ✅ getHomeTeams()
GET /football-get-list-away-team?leagueid=X              ✅ getAwayTeams()
GET /football-league-team?teamid=X                       ✅ getTeamInfo()
GET /football-team-logo?teamid=X                         ✅ getTeamLogo()
```

### 👤 Jugadores (2/2)

```
GET /football-get-player-detail?playerid=X               ✅ getPlayerDetail()
GET /football-get-player-logo?playerid=X                 ✅ getPlayerLogo()
```

### 📋 Detalle Partido (3/6)

```
GET /football-get-match-detail?eventid=X                  ✅ getMatchDetail()
GET /football-get-match-score?eventid=X                  ✅ getMatchScore()
GET /football-get-match-status?eventid=X                  ✅ getMatchStatus()
GET /football-get-match-highlights?eventid=X             ❌ (sin uso)
GET /football-get-match-location?eventid=X              ❌ (sin uso)
GET /football-get-match-referee?eventid=X                ❌ (sin uso)
```

### 📈 Estadísticas (3/3)

```
GET /football-get-match-all-stats?eventid=X              ✅ getMatchAllStats()
GET /football-get-match-firstHalf-stats?eventid=X        ✅ getMatchFirstHalfStats()
GET /football-get-match-secondhalf-stats?eventid=X       ✅ getMatchSecondHalfStats()
```

### 📊 Clasificaciones (3/3)

```
GET /football-get-standing-all?leagueid=X                ✅ getStandings()
GET /football-get-standing-home?leagueid=X               ✅ getHomeStandings()
GET /football-get-standing-away?leagueid=X               ✅ getAwayStandings()
```

### 🏅 Top Jugadores (3/3)

```
GET /football-get-top-players-by-assists?leagueid=X      ✅ getTopAssists()
GET /football-get-top-players-by-goals?leagueid=X        ✅ getTopScorers()
GET /football-get-top-players-by-rating?leagueid=X       ✅ getTopRating()
```

---

## ❌ Endpoints Sin Implementar (7)

### 🔍 Búsquedas

```
GET /football-matches-search?search=texto                 # Para buscar partidos por texto
```

### 📋 Detalle Partido

```
GET /football-get-match-highlights?eventid=X             # Highlights del partido
GET /football-get-match-location?eventid=X              # Ubicación/estadio del partido
GET /football-get-match-referee?eventid=X                # Árbitro del partido
```

### 💰 Odds (3 endpoints - para sistema de apuestas)

```
GET /football-event-odds?eventid=X&countrycode=BR       # Cuotas de una apuesta
GET /football-get-match-oddspoll?eventid=X              # poll de cuotas
GET /football-get-match-odds-voteresult?eventid=X       # resultado del poll de cuotas
```

---

## Códigos de Ligas Comunes

| Liga             | league_id |
| ---------------- | --------- |
| Premier League   | 47        |
| La Liga          | 87        |
| Bundesliga       | 54        |
| Serie A          | 55        |
| Ligue 1          | 53        |
| Champions League | 42        |
| Europa League    | 73        |
| Copa del Rey     | 138       |
| FA Cup           | 132       |
| Mundial          | 77        |
| Copa America     | 13        |

---

## Ejemplo de Response (Teams Search)

```json
{
  "status": "success",
  "response": {
    "teams": [
      {
        "team_id": "9909",
        "team_name": "Brazil",
        "league_id": "77",
        "league_name": "World Cup",
        "team_logo": "https://images.fotmob.com/teamlogos/9909.png"
      }
    ]
  }
}
```

---

## Ejemplo de Response (Match Detail)

```json
{
  "status": "success",
  "response": {
    "match": {
      "match_id": "4621624",
      "league_id": "42",
      "league_name": "Champions League",
      "match_date": "2024-11-07",
      "match_time": "21:00",
      "home_team": {
        "team_id": "8650",
        "team_name": "Real Madrid",
        "team_logo": "https://images.fotmob.com/teamlogos/8650.png"
      },
      "away_team": {
        "team_id": "8635",
        "team_name": "AC Milan",
        "team_logo": "https://images.fotmob.com/teamlogos/8635.png"
      },
      "home_score": "2",
      "away_score": "1",
      "match_status": "FINISHED"
    }
  }
}
```

---

## Resumen

| Estado             | Cantidad |
| ------------------ | -------- |
| ✅ Implementados   | 27       |
| ❌ Sin implementar | 7        |
| **Total**          | **34**   |
