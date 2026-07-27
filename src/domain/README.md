# `domain/` — Núcleo puro

Reglas de negocio independientes de frameworks y de I/O. **No importa de ninguna otra capa.**

- `entities/` — objetos de negocio con identidad: `Match`, `Team`, `Competition`, `Athlete`, `BetSlip`, `BetSelection`, `User`, `Standing`.
- `value-objects/` — sin identidad, inmutables: `Market`, `Score`, `MatchStatus`, `CompetitionId`.
- `ports/` — **interfaces** (contratos) que `application` consume y que `infrastructure` implementa: `ScoresGateway`, `MatchRepository`, `UserRepository`, `BetFollowerRepository`, `NluGateway`, `OcrGateway`, `Notifier`.

Prohibido acá: `require('pg')`, `require('https')`, Telegram, Supabase, cualquier cosa con efecto de red o disco.
