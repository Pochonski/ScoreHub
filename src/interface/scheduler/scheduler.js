require('dotenv').config();
const cron = require('node-cron');
const { createSyncOrchestrator } = require('../../application/sync/orchestrator');
const { testConnection } = require('../../../database/connection');
const { install: installProcessGuard } = require('../../../utils/processGuard');
const log = require('../../../utils/logger');
const jobGuard = require('../../../utils/jobGuard');
installProcessGuard({ name: 'sync', logger: log });

async function start() {
  const connected = await testConnection();
  if (!connected) {
    log.error('No se pudo conectar a la base de datos. Saliendo.');
    process.exit(1);
  }

  // T1.2: scheduler usa el syncOrchestrator use-case con DI explícita.
  // Antes: `sync.syncAll()` directo sobre el módulo legacy. Ahora el
  // orchestrator devuelve {runId, jobs[], successful, failed} para mejor
  // observabilidad vía logs.
  const sync = createSyncOrchestrator({ logger: log });

  // Run full sync immediately on startup.
  // Fase 8.1: se ejecuta en background para no bloquear el startup si un job
  // tarda (los crons tienen jobGuard anti-solapamiento).
  log.info('Iniciando sync completo inicial (background)...');
  sync.runFullSync().then((r) => {
    log.info({ runId: r.runId, ok: r.successful, failed: r.failed }, 'full sync initial done');
  }).catch((err) => {
    log.error({ err: err.message }, 'syncAll failed');
  });

  // Helper para schedulear con guard anti-solapamiento
  const every = (expr, name, fn) => cron.schedule(expr, jobGuard.wrap(name, fn));

  // Live games — every 15 seconds
  every('*/15 * * * * *', 'syncLiveGames', () => sync.runGames());
  every('*/15 * * * * *', 'syncLiveStats', () => sync.runDetails());

  // Games, results, fixtures — every 60 seconds
  every('*/60 * * * * *', 'syncGames', () => sync.runGames());
  every('*/60 * * * * *', 'syncGamesResults', () => sync.runGames());
  every('*/60 * * * * *', 'syncFixtures', () => sync.runGames());

  // Standings, trends — every 2 minutes
  every('*/2 * * * *', 'syncStandings', () => sync.runStandings());
  every('*/2 * * * *', 'syncTrends', () => sync.runTrendsOdds());

  // Tips por partido (feed game-level): 1 call por partido, cambian lento → 10min
  every('*/10 * * * *', 'syncGameTrends', () => sync.runTrendsOdds());

  // Predictions, odds — every 5 minutes
  every('*/5 * * * *', 'syncPredictions', () => sync.runTrendsOdds());
  every('*/5 * * * *', 'syncOdds', () => sync.runTrendsOdds());

  // Brackets, tournament stats, team of week, game details, outrights, venues, athletes — every 10 minutes
  every('*/10 * * * *', 'syncBrackets', () => sync.runContent());
  every('*/10 * * * *', 'syncTournamentStats', () => sync.runContent());
  every('*/10 * * * *', 'syncTeamOfWeek', () => sync.runContent());
  every('*/10 * * * *', 'syncGameDetails', () => sync.runDetails());
  every('*/10 * * * *', 'syncOutrights', () => sync.runTrendsOdds());
  every('*/10 * * * *', 'syncVenues', () => sync.runAthletes());
  every('*/10 * * * *', 'syncAthletes', () => sync.runAthletes());

  // News — every 10 minutes
  every('*/10 * * * *', 'syncNews', () => sync.runContent());

  // Bet selections — every 2 minutes (Fase 8.6+: evalúa selecciones pendientes
  // de apuestas cuyo partido asociado terminó, actualizando estado y valor_actual)
  every('*/2 * * * *', 'syncBetSelections', () => sync.runBetSelections());

  // Suggestions (top upcoming games) — every 30 minutes (cambian poco)
  every('*/30 * * * *', 'syncSuggestions', () => sync.runTransfers());

  // Trend details — every 30 minutes (Fase 8.3 — cierra /trends/details)
  every('*/30 * * * *', 'syncTrendDetails', () => sync.runTrendsOdds());

  // Transfers (fichajes por equipo) — cada 6 horas (cambian lento)
  every('0 */6 * * *', 'syncTransfers', () => sync.runTransfers());

  // Catalog and countries — every 6 hours
  every('0 */6 * * *', 'syncCatalog', () => sync.runCatalog());
  every('0 */6 * * *', 'syncCountries', () => sync.runCatalog());

  // History — every 24 hours
  every('0 3 * * *', 'syncCompetitionHistory', () => sync.runContent());

  log.info('Todos los cron jobs scheduleados (con guards anti-solapamiento). Servicio corriendo.');
}

module.exports = { start };

// Entry directo: `node src/interface/scheduler/scheduler.js` (además del entry
// fino en sync.js para compatibilidad con el deploy existente).
if (require.main === module) {
  start().catch((err) => {
    log.error({ err }, 'Fatal error en sync');
    process.exit(1);
  });
}
