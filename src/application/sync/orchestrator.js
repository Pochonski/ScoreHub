/**
 * src/application/sync/orchestrator.js — Orquestador de sync con DI explícita (Fase 4).
 *
 * Los sync jobs ya están divididos en 9 módulos por dominio (games, standings,
 * content, trendsOdds, details, catalog, athletes, transfers, betSelections) —
 * ver syncService.js. Esta capa agrega esos jobs en una corrida completa
 * (`runFullSync`) y en sub-corridas (por dominio) para el scheduler.
 *
 * A diferencia del `syncAll` legacy, este orquestador recibe `runIdGenerator`,
 * `logger` y `clock` como deps. Tests pueden inyectar fakes; scheduler
 * inyecta los reales.
 */

const { newSyncRunId, setSyncRunId, log: contextLog } = require('./context');
const games = require('./games');
const standings = require('./standings');
const content = require('./content');
const trendsOdds = require('./trendsOdds');
const details = require('./details');
const catalog = require('./catalog');
const athletes = require('./athletes');
const transfers = require('./transfers');
const betSelections = require('./betSelections');

function createSyncOrchestrator({
  runIdGenerator = newSyncRunId,
  logger = contextLog,
  clock = () => new Date(),
} = {}) {
  if (typeof runIdGenerator !== 'function') {
    throw new Error('createSyncOrchestrator: runIdGenerator must be a function');
  }

  // Plan por defecto — Fase 8.1: algunos jobs lentos (syncGameDetails,
  // syncAthletes) se quitaron del plan completo porque se interbloquean
  // con los crons. Los cubre el cron de 10min.
  const DEFAULT_FULL_PLAN = [
    () => catalog.syncCatalog(),
    () => catalog.syncCountries(),
    () => games.syncLiveGames(),
    () => games.syncGamesResults(),
    () => games.syncFixtures(),
    () => standings.syncStandings(),
    () => content.syncBrackets(),
    () => content.syncTournamentStats(),
    () => content.syncTeamOfWeek(),
    () => content.syncCompetitionHistory(),
    () => content.syncNews(),
    () => trendsOdds.syncTrends(),
    () => trendsOdds.syncGameTrends(),
    () => trendsOdds.syncTrendDetails(),
    () => trendsOdds.syncPredictions(),
    () => trendsOdds.syncOutrights(),
    () => trendsOdds.syncOdds(),
    () => details.syncLiveStats(),
    () => athletes.syncVenues(),
    () => transfers.syncTransfers(),
    () => transfers.syncSuggestions(),
  ];

  async function runFullSync({ plan = DEFAULT_FULL_PLAN } = {}) {
    const startedAt = clock();
    const runId = runIdGenerator();
    setSyncRunId(runId);
    logger?.(`[sync:${runId}] Running full sync (${plan.length} jobs)`);
    const results = [];
    try {
      for (let i = 0; i < plan.length; i++) {
        const step = plan[i];
        try {
          const r = await step();
          // El campo `ok` es interno del orquestador — si el use-case
          // devuelve su propio `{ ok: 0 }` (semánticamente éxito pero
          // numéricamente falsy), no lo pisamos. Usamos `jobOk` para el
          // status interno y mergeamos los campos del result con spread.
          results.push({ index: i, jobOk: true, ...(r || {}) });
        } catch (e) {
          results.push({ index: i, jobOk: false, error: e.message });
          logger?.(`[sync:${runId}] Job ${i} failed: ${e.message}`);
        }
      }
    } finally {
      setSyncRunId(null);
    }
    const finishedAt = clock();
    return {
      runId,
      startedAt,
      finishedAt,
      jobs: results,
      totalJobs: plan.length,
      successful: results.filter((r) => r.jobOk).length,
      failed: results.filter((r) => !r.jobOk).length,
    };
  }

  // Sub-corridas por dominio — útiles para el scheduler cuando quiere
  // ejecutar sólo un subset (ej: crons de 2min corren solo betSelections).
  async function runGames() {
    setSyncRunId(runIdGenerator());
    try {
      await games.syncLiveGames();
      await games.syncGamesResults();
      await games.syncFixtures();
    } finally { setSyncRunId(null); }
  }

  async function runStandings() {
    setSyncRunId(runIdGenerator());
    try { await standings.syncStandings(); }
    finally { setSyncRunId(null); }
  }

  async function runContent() {
    setSyncRunId(runIdGenerator());
    try {
      await content.syncBrackets();
      await content.syncTournamentStats();
      await content.syncTeamOfWeek();
      await content.syncCompetitionHistory();
      await content.syncNews();
    } finally { setSyncRunId(null); }
  }

  async function runTrendsOdds() {
    setSyncRunId(runIdGenerator());
    try {
      await trendsOdds.syncTrends();
      await trendsOdds.syncGameTrends();
      await trendsOdds.syncTrendDetails();
      await trendsOdds.syncPredictions();
      await trendsOdds.syncOutrights();
      await trendsOdds.syncOdds();
    } finally { setSyncRunId(null); }
  }

  async function runDetails() {
    setSyncRunId(runIdGenerator());
    try { await details.syncLiveStats(); }
    finally { setSyncRunId(null); }
  }

  async function runCatalog() {
    setSyncRunId(runIdGenerator());
    try {
      await catalog.syncCatalog();
      await catalog.syncCountries();
    } finally { setSyncRunId(null); }
  }

  async function runAthletes() {
    setSyncRunId(runIdGenerator());
    try { await athletes.syncVenues(); }
    finally { setSyncRunId(null); }
  }

  async function runTransfers() {
    setSyncRunId(runIdGenerator());
    try {
      await transfers.syncTransfers();
      await transfers.syncSuggestions();
    } finally { setSyncRunId(null); }
  }

  async function runBetSelections() {
    setSyncRunId(runIdGenerator());
    try { await betSelections.syncBetSelections(); }
    finally { setSyncRunId(null); }
  }

  return {
    runFullSync,
    runGames,
    runStandings,
    runContent,
    runTrendsOdds,
    runDetails,
    runCatalog,
    runAthletes,
    runTransfers,
    runBetSelections,
    DEFAULT_FULL_PLAN,
  };
}

module.exports = { createSyncOrchestrator };
