# `application/` — Casos de uso

Orquestan el dominio para cumplir una acción concreta. **Importan solo `domain/`** (entities + ports).
No conocen Telegram, ni Supabase, ni 365scores: hablan con puertos.

Un caso de uso por acción:

- `matches/` — `GetLiveMatches`, `GetFixture`, `GetMatchPreview`, `GetH2H`, `GetOdds`, `GetTrends`…
- `teams/` — `FollowTeam`, `UnfollowTeam`, `ListFavorites`, `GetTeamNextMatches`…
- `betting/` — `ParseBetSlip`, `EvaluateBetSlip`, `TrackBetSlip`…
- `stats/`, `history/` — un caso de uso por comando del bot.
- `sync/` — `SyncLiveGames`, `SyncStandings`, `SyncAthletes`… (los 20 jobs de `sync.js`).

Cada caso de uso recibe sus dependencias por constructor/parámetro (inyección), nunca las importa directo.
