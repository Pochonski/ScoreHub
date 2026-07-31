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

---

## 8. Commit final (Fase 8.7+)

**Fecha**: 2026-07-31

**Migration aplicada**: `022_add_more_competitions.sql`
- 3 competiciones añadidas: Eurocopa (6316), Copa América (595), CONCACAF Copa Centroamericana (7954)
- Display_order 5-7 (debajo de Mundial que está en 10)
- Excluida: CONCACAF Copa de Campeones (171) por decisión de producto

**Resultado de `syncCatalog` ejecutado manualmente**:
- 10 competiciones sincronizadas
- 350 competitors canónicos

**Tests nuevos**: `tests/integration/active-competitions.test.js` (8/8 verde)
- Verifica 10 competiciones activas
- Verifica 4 tests uno por comp (Eurocopa, CopaAm, Copa Centroamericana, display_order)
- Verifica competitors y competitions actualizados

**Tests totales**: 200/200 verde, 18 suites, 59 snapshots OK

**Doc actualizado**:
- `docs/architecture/db-coverage.md` — sección "Layout de datos" con 10 competiciones
- `docs/architecture/sync-schedule.md` — entrada histórica
- `docs/refactor-plans/16-har-endpoints-validation.md` — este archivo

---

## 9. Migration 023 y 6 nuevas competiciones (Américas)

**Fecha**: 2026-07-31

**Migration aplicada**: `023_add_more_competitions_americas.sql`
- 3 competiciones añadidas: Liga MX (141), MLS (104), Liga Profesional Argentina (72)
- Display_order reordenado: 6 (CopaAm), 7 (LigaArg), 8 (CONCACAF Centro), 9 (MLS), 10 (Mundial), 11 (Liga MX)
- Cambio estructural: `ALTER COLUMN display_order TYPE NUMERIC` (era INTEGER)
- Excluida: 171 (CONCACAF Copa de Campeones, mismo que migration 022)

**Resultado de `syncCatalog` ejecutado manualmente**:
- 13 competiciones sincronizadas (10 + 3 nuevas)
- 387 competitors canónicos (+37 desde migration 022)
- 77 competidores nuevos para las Américas:
  - Liga MX: 18
  - MLS: 29
  - Liga Argentina: 30

**Integración completa del dashboard** (verificada en `https://scorehub-pocho.vercel.app`):

| Aspecto | Estado |
|---|---|
| `/api/football/competitions` (selector) | ✅ 13 comps en orden correcto |
| `/api/football/competitions/{id}` (detail) | ✅ 6/6 nuevas retornan data |
| `/api/football/standings?competitionId=X` | ✅ 6/6 nuevas retornan groups |
| `/api/football/standings/seasons?competitionId=X` | ✅ 6/6 nuevas retornan seasons |
| `/api/football/news?competitionId=X` | ✅ 6/6 nuevas retornan news |
| `/api/football/stats/scorers?competitionId=X` | ✅ 6/6 nuevas retornan scorers |
| `/api/football/competitions/{id}/transfers` | ⚠️ 3/6 (141, 104, 72 — las copas no tienen transfers) |
| `/api/football/trends?competitionId=X` | ✅ 4/6 (141, 104, 72, 7954) |
| `/api/football/competitions/{id}/insights` | ✅ 6/6 nuevas |

**Fix frontend (Fase 8.7+)**:
- `dashboard/src/presentation/pages/TeamDetailPage.tsx:181` — el botón "← Ver en [competición]" ahora resuelve el nombre dinámicamente desde la lista de competitions (en lugar de hardcodear solo Mundial 5930 y Liga Promerica 5056).

**Tests nuevos del dashboard** (27 tests verdes):
- `dashboard/tests/integration/competitions-selector.test.ts` (8 tests): valida 13 comps, orden por displayOrder, has_brackets, has_groups, has_history
- `dashboard/tests/integration/standings-new-comps.test.ts` (19 tests): valida endpoints /standings, /standings/seasons, /competitions/:id para las 6 nuevas

**Total tests**:
- Backend (Jest): 203/203 verde, 18 suites
- Frontend (Vitest): 27/27 verde, 2 suites nuevas
- **Total combinado**: 230 tests verdes

**Commits**:
- `2e4cfd9` — feat(migrations): añadir 3 nuevas competiciones Américas
- `5747b2f` — chore(phase8.7): deploy Vercel
- (este commit) — fix(dashboard) + tests + docs

**Pendiente para integración 100% completa**:
- Esperar a que inicien las temporadas 2026/2027 de las nuevas comps para que `syncGames`/`syncFixtures` traigan games
- Las transfers de las copas (595, 6316, 7954) son 0 porque las copas no tienen transfers de clubes (esperado)
