# Plan de mejora de tests

Revisión (2026-08-05): las suites se crearon al principio (modelo Mundial-only) y
tienen dos problemas: tests que pasan **en vacío** y grandes huecos de cobertura
en lo crítico/nuevo. Cada fase es un PR independiente.

Estado de cobertura al iniciar: frontend 9/63 componentes y 0/7 pages; API 4/12
controllers; lógica de apuestas ~0/5 módulos.

---

## Fase 1 — Cimientos: que el verde sea REAL 🔴 ✅ HECHA (PR pendiente)
Se reemplazó `if (!connected) return` (✓ falso) por **gate con skip VISIBLE**:
suites que requieren DB real se saltan por defecto y corren con `RUN_DB_TESTS=1`
(falla visible si la DB no responde). El test acoplado a prod se gatea con
`RUN_E2E_PROD=1`.
- [x] `tests/integration/active-competitions.test.js` → `RUN_DB_TESTS`
- [x] `tests/integration/bot.persistence.test.js` → `RUN_DB_TESTS`
- [x] `tests/integration/simulate-bot.test.js` → `RUN_DB_TESTS`
- [x] `tests/sync.freshness.test.js` → `RUN_DB_TESTS` *(tenía el mismo patrón)*
- [x] `dashboard/tests/integration/standings-new-comps.test.ts` → `RUN_E2E_PROD`
- (`supabase-strategy.test.js` ya era determinista — no requería cambios.)
- **Resultado:** root jest 4 suites / 53 tests ahora **skipped visibles** (antes ✓
  falsos); vitest 1 file / 19 tests skipped. El resto (150 + 107) aserta de verdad.

## Fase 2 — Lógica de apuestas (unit) 🔴
- [ ] `betParserService` · [ ] `betEvaluator` · [ ] `marketNormalizer`
- [ ] `intentParser` · [ ] `betTrackingEngine`

## Fase 3 — Sync: cerrar el hueco reciente 🔴
- [ ] Test directo de `syncGameTrends` / `trendsOdds` (query per-competición,
      `GAMES_PER_COMP`) vía mock estilo `dbCapture`.

## Fase 4 — Controllers del API (8 sin cobertura) 🟠
- [ ] `statsController` (scorers/assists/team-of-week) · [ ] `transfersController`
- [ ] `historyController` · [ ] `trendController` · [ ] `teamController`
- [ ] `infoController` · [ ] `teamEnhancementsController` · [ ] `trendDetailController`

## Fase 5 — Frontend: UI de apuestas + hooks 🟡
- [ ] `BetTrendRow` · [ ] `BettingTrends` · [ ] `MatchTipCard` · [ ] `AnalysisTab` · [ ] `NewsTab`
- [ ] hooks: `useTrends` · `useMatchTips` · `useGames` · `useCompetitions`

## Fase 6 — Frontend: pages + ampliar componentes 🟢
- [ ] Smoke/render de las 7 pages
- [ ] Ampliar cobertura de componentes (9/63 → los de mayor uso)
