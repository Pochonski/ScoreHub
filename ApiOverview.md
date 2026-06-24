# Free API Live Football Data - Overview

## Descripción

API gratuita de datos de fútbol que ofrece acceso a más de 2100 ligas de fútbol, livescores, jugadores, equipos, estadísticas, clasificaciones, probabilidades, fixtures, eventos, partidos, alineaciones y cobertura en vivo.

## Características

- **2100+ ligas** de fútbol mundial
- **Livescores** en tiempo real
- **Estadísticas detalladas** de partidos
- **Clasificaciones** de ligas
- **Plantillas de equipos** con jugadores
- **Búsqueda** de equipos y partidos
- **Head to Head** entre equipos

## Información de la API

|属性|Valor|
|---|---|
| **Base URL** | `https://free-api-live-football-data.p.rapidapi.com` |
| **Host** | `free-api-live-football-data.p.rapidapi.com` |
| **Protocol** | REST |
| **Formato** | JSON |

## Endpoints Principales

| Endpoint | Descripción |
|----------|-------------|
| `/football-popular-leagues` | Lista de ligas populares |
| `/football-livescores` | Partidos en vivo ahora |
| `/football-getfixturesbydate` | Partidos por fecha |
| `/football-getalleaguesmatches` | Todos los partidos de una liga |
| `/football-getteambyid` | Información de equipo |
| `/football-getplayersbyteamid` | Jugadores de un equipo |
| `/football-getmatchbymatchid` | Detalle de partido |
| `/football-getmatchstatistics` | Estadísticas de partido |
| `/football-getstandingsbyleagueid` | Tabla de posiciones |
| `/football-getheadtohead` | Enfrentamientos directos |
| `/football-searchteams` | Búsqueda de equipos |

## Uso en el Proyecto

Esta API se utiliza en `services/footballApi.js` para:

1. **Búsqueda de equipos** - `searchTeams(name)`
2. **Información de equipos** - `getTeamInfo(teamId)`
3. **Jugadores de equipo** - `getTeamPlayers(teamId)`
4. **Livescores** - `getTodayMatches()`
5. **Detalle de partido** - `getMatchById(matchId)`
6. **Estadísticas** - `getMatchStats(eventId)`
7. **Clasificaciones** - `getStandings(leagueId)`
8. **Head to Head** - `getHeadToHead(team1, team2)`

## Rate Limits

Consultar documentación oficial de RapidAPI para límites del plan gratuito.

## Registro

Para obtener API Key: https://rapidapi.com/free-api-live-football-data
