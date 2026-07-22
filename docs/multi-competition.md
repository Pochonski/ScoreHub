# Multi-Competición

ScoreHub soporta múltiples competiciones simultáneamente (Mundial 2026 + Liga Promerica CR + futuras). Esta guía explica cómo añadir, mantener y consultar la lista.

## Tabla `active_competitions`

Lista curada de competiciones que el sitio expone. Vive en la DB y se mantiene con SQL directo (no hay CRUD desde el panel admin todavía).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INT PK | ID upstream de 365scores (ej. Mundial=5930, Liga Promerica=5056) |
| `display_name` | TEXT | Nombre completo que verá el usuario ("Copa Mundial de la FIFA 2026") |
| `short_name` | TEXT | Nombre corto para tabs y dropdown ("Mundial 2026") |
| `country_id` | INT | ID del país upstream (54=Internacional, 153=Costa Rica) |
| `country_name` | TEXT | Nombre del país ("Costa Rica") |
| `season_num` | INT | Temporada actual (25, 146...) |
| `season_label` | TEXT | Etiqueta legible ("2026", "2026/2027") |
| `start_date` | DATE | Inicio del sync window para games/fixtures |
| `end_date` | DATE | Fin del sync window |
| `is_active` | BOOL | Si FALSE, la API devuelve 404 con `?competitionId=X` |
| `is_featured` | BOOL | TRUE → aparece en los tabs de la home y en el dropdown del navbar |
| `display_order` | INT | Menor = primero |
| `has_brackets` | BOOL | TRUE → muestra tab "Eliminatorias" en `/competicion/:id` |
| `has_groups` | BOOL | TRUE → muestra tab "Posiciones" en `/competicion/:id` |
| `has_history` | BOOL | TRUE → llama `getCompetitionHistory` upstream |
| `config` | JSONB | Extensible (futuro: logos, colores, links) |

## Añadir una nueva competición

```sql
INSERT INTO active_competitions
  (id, display_name, short_name, country_id, country_name,
   season_num, season_label, start_date, end_date,
   is_active, is_featured, display_order,
   has_brackets, has_groups, has_history)
VALUES
  (82, 'Copa América 2028', 'Copa América', 17, 'Sudamérica',
   1, '2028', '2028-06-01', '2028-07-15',
   TRUE, TRUE, 30, TRUE, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  season_num = EXCLUDED.season_num,
  season_label = EXCLUDED.season_label,
  updated_at = now();
```

Una vez insertada:
1. **No requiere redeploy** — la tabla se lee en cada request (con cache 5min).
2. El próximo ciclo del sync (cada 10 min para standings/fixtures/standings, cada 6h para catalog) descubre la comp automáticamente.
3. Aparece en `/competiciones` y en los tabs de la home si `is_featured=true`.
4. Endpoint de detalle: `GET /api/football/competitions/:id` (incluye `seasons[]`).

## API

### Endpoints nuevos

```
GET /api/football/competitions              → lista curada (active_competitions)
GET /api/football/competitions/featured     → solo is_featured=true (home tabs)
GET /api/football/competitions/:id          → detalle con seasons[] (cached)
GET /api/football/competitions/:id/seasons → solo seasons[] del upstream
```

### Compatibilidad hacia atrás

Todos los endpoints existentes aceptan `?competitionId=`. Si no se pasa, usan `process.env.PRIMARY_COMPETITION_ID` (default `5930` = Mundial).

```bash
# Mundial (default)
GET /api/football/matches
GET /api/football/standings

# Liga Promerica
GET /api/football/matches?competitionId=5056
GET /api/football/standings?competitionId=5056

# Todas las activas (mezcla partidos de Mundial + Promerica + ...)
GET /api/football/matches?all=true
GET /api/football/matches/live?all=true
```

## URLs frontend

| Ruta | Renderiza |
|---|---|
| `/competiciones` | Grid de cards con todas las activas |
| `/competicion/:id/:tab?` | Página de la competición. `:tab` ∈ `standings`/`brackets`/`stats`/`history`. Default = `standings`. |
| `/competicion` (legacy) | Redirect 301 → `/competicion/5930/standings` |

Tabs visibles se filtran según `hasGroups`/`hasBrackets`. Por ejemplo, Liga Promerica (sin eliminatorias) no muestra el tab `brackets`.

## Arquitectura del sync

`services/syncService.js` ahora itera `active_competitions` en cada ciclo:

```js
await forEachActive(async (comp) => {
  await syncGamesForComp(comp)
  await syncStandingsForComp(comp)
  // ...
})
```

`forEachActive` ejecuta en serie (recomendado para no saturar upstream) y captura errores por competición: si una falla, las demás siguen.

## Variables de entorno

`PRIMARY_COMPETITION_ID` se mantiene como **fallback del Mundial** para requests sin `?competitionId=`. Una vez que la lista activa está populada, todas las decisiones se leen de la DB.

Vercel env (recomendado):
- `PRIMARY_COMPETITION_ID=5930` (no cambiar — fallback)
- `VITE_PRIMARY_COMPETITION_ID=5930` (frontend default)

## Cómo encontrar nuevos IDs upstream

```bash
# Ver todas las competiciones de un país (ej. CR = 153)
curl "https://webws.365scores.com/web/competitions/?countries=153&appTypeId=5&langId=14&timezoneName=America/Costa_Rica&userCountryId=153"

# Destacadas globales (no por país)
curl "https://webws.365scores.com/web/competitions/featured/?sports=1&withSeasons=true&appTypeId=5&langId=14&timezoneName=America/Costa_Rica&userCountryId=153"
```

Cada objeto trae `{id, name, countryId, currentSeasonNum, hasBrackets, hasGroups, hasHistory}`. Inserta en la tabla con esos valores.

## Limitaciones conocidas

- **No hay CRUD UI**: añadir/quitar comps requiere SQL directo.
- **Multi-idioma**: aún no hay i18n.
- **Bot Telegram**: sigue apuntando al Mundial (out of scope).
- **Sync secuencial**: 2 comps tardan ~2× lo que tardaba 1; con 10 comps se nota. Se puede cambiar a `parallel: true` en `forEachActive` si hace falta.
- **Logos por competición**: no hay todavía — se muestra solo el nombre. Se puede añadir vía `config->logoUrl` o columna nueva.
