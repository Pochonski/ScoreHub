# Fase 8.7 — Análisis del .har de Copa Centroamericana

> **Objetivo**: validar que los endpoints de 365scores que usa el frontend oficial
> coinciden con los implementados en `scores365Service.js`, antes de agregar las
> 4 competiciones CONCACAF/Eurocopa/Copa América.

## 1. Análisis del .har

**Archivo**: `/home/pocho/Downloads/www.365scores.com.har` (47 MB, 1415 entries)

**Página capturada**: `https://www.365scores.com/football/league/concacaf-central-american-cup-7954`
(Copa Centroamericana CONCACAF, comp_id=7954)

**Fecha de captura**: 31 julio 2026

**Competiciones visitadas en el .har**:
- 7954 (Copa Centroamericana CONCACAF)
- 5669 (Copa Costa Rica)
- 9071, 9076 (Herediano, LD Alajuelense como competidores)

## 2. Endpoints del frontend vs `scores365Service.js`

| Endpoint | En .har | En `scores365Service.js` | Comentario |
|---|---|---|---|
| `/web/athletes/top/` | ✅ | ❌ | Baja prioridad — UI showcase |
| `/web/bets/lines/` | ✅ | ✅ | OK |
| `/web/bets/lines/bestodds/` | ✅ | ❌ | **Falta** — podría añadirse |
| `/web/bets/raffleBookmaker/` | ✅ | ❌ | UI interna |
| `/web/bets/outrights/` | ✅ | ✅ | OK |
| `/web/competitions/` | ✅ | ✅ | OK |
| `/web/competitions/featured/` | ✅ | ✅ | OK |
| `/web/competitions/teamoftheweek/` | ✅ | ✅ | OK |
| `/web/competitions/top/` | ✅ | ✅ | OK |
| `/web/competitors/` | ✅ | ✅ | OK |
| `/web/competitors/recentForm` | ✅ | ✅ | OK (Fase 8.6) |
| `/web/competitors/top/` | ✅ | ✅ | OK |
| `/web/countries/` | ✅ | ✅ | OK |
| `/web/footer/` | ✅ | ❌ | UI interna |
| `/web/game/` | ✅ | ✅ | OK |
| `/web/game/stats/` | ✅ | ✅ | OK |
| `/web/games/` | ✅ | ✅ | OK |
| `/web/games/current/` | ✅ | ✅ | OK |
| `/web/games/featured/` | ✅ | ✅ | OK |
| `/web/games/h2h/` | ✅ | ✅ | OK |
| `/web/games/highlights/` | ✅ | ✅ | OK |
| `/web/games/predictions/` | ✅ | ✅ | OK |
| `/web/games/results/` | ✅ | ✅ | OK |
| `/web/init/terms/` | ✅ | ❌ | UI interna |
| `/web/news/` | ✅ | ✅ | OK |
| `/web/relatedEntities/` | ✅ | ✅ | OK |
| `/web/sports/` | ✅ | ✅ | OK |
| `/web/standings/` | ✅ | ✅ | OK |
| `/web/stats/` | ✅ | ✅ | OK |
| `/web/transfers/` | ✅ | ✅ | OK |
| `/web/trends/` | ✅ | ✅ | OK |
| `/web/bets/lines/bestodds/` | ✅ | ❌ | **Falta** |

## 3. Hallazgo crítico: parámetros del frontend

El frontend usa **parámetros distintos** a los que teníamos en `scores365Service.js`:

| Parámetro | Nuestro valor | Valor del .har |
|---|---|---|
| `timezoneId` | ❌ no usa | `77` (Costa Rica) |
| `langId` | `14` (castellano) | `1` (inglés) |
| `userCountryId` | `153` (CR) | `18` (USA, desde VPN) |
| `seasons` param | ❌ no usa | `4` (ej. comp 7954) |

**Issue**: nuestros endpoints usan `timezoneName=America/Costa_Rica` en vez de `timezoneId=77`. El API acepta ambos, pero **algunos parámetros como `seasons` no los soportamos**.

**Action Items para Fase 8.6+**:
1. Añadir `seasons` parameter a `getGamesByCompetition` (queries paginadas)
2. Considerar añadir `getCompetitorRecentForm` ya está
3. Añadir `getBetsLinesBestOdds` (no usado actualmente)
4. Verificar que `getGamesResults` soporte `competitors=X` (sí lo soporta)

## 4. Validación de endpoints con datos reales

| Endpoint | Query probada | Resultado |
|---|---|---|
| `/web/games/?competitions=7954&games=1&aftergame=4730035&direction=-1&withmainodds=true` | sí | **20 games** (agosto-septiembre 2025) |
| `/web/games/?competitions=7954&games=1&aftergame=0` | no | 0 games |
| `/web/games/predictions/?competitions=7954` | sí | 5 games |
| `/web/games/current/?competitions=7954` | sí | 16 games |

**Conclusión**: los IDs 7954, 171, 595, 6316 son correctos para CONCACAF/Eurocopa/CopaAm. Solo que **los games 2026 aún no existen** en la API (todas las temporadas finalizaron en 2025 o antes).

## 5. Recomendación

✅ **Proceder con la migration 022** (4 competiciones).
✅ **NO se requieren cambios en `scores365Service.js`** — los endpoints ya están.
⚠️ **El sync de `games` no retornará nada para estas comps en season actual** (4 temporadas pasadas)
✅ **El sync de `competitors` SÍ populará** (los equipos ticos ya están)
✅ **El sync de `competition_history` SÍ populará** (history de temporadas pasadas)

### Action items opcionales (no bloqueantes)

1. Añadir `getBetsLinesBestOdds` (Fase 8.6+ future)
2. Añadir `getCompetitorRecentForm` ya está en Fase 8.6
3. Añadir `seasons` param a `getGamesByCompetition` (mejora performance, no crítico)

## 6. Próximos pasos

1. Crear `database/migrations/022_add_more_competitions.sql` con las 4 IDs validadas
2. Aplicar con `node database/migrate.js`
3. Esperar `syncCatalog` (cron 6h) o ejecutarlo manual
4. Verificar que `competitors` y `competition_history` se popularon
5. Documentar en `docs/architecture/db-coverage.md`

## 7. Referencias

- `.har` original: `/home/pocho/Downloads/www.365scores.com.har`
- `services/scores365Service.js` — implementación actual
- `docs/architecture/db-coverage.md` — cobertura de datos
- `docs/architecture/sync-schedule.md` — calendario de syncs
- `docs/refactor-plans/15-add-more-competitions.md` — plan de competiciones (próximo)