require('dotenv').config();
const cron = require('node-cron');
const sync = require('./services/syncService');
const { testConnection } = require('./database/connection');
const { install: installProcessGuard } = require('./utils/processGuard');
const log = require('./utils/logger');
const jobGuard = require('./utils/jobGuard');
installProcessGuard({ name: 'sync', logger: log });

async function main() {
  const connected = await testConnection();
  if (!connected) {
    log.error('No se pudo conectar a la base de datos. Saliendo.');
    process.exit(1);
  }

  // Run full sync immediately on startup
  log.info('Iniciando sync completo inicial...');
  await sync.syncAll();

  // Helper para schedulear con guard anti-solapamiento
  const every = (expr, name, fn) => cron.schedule(expr, jobGuard.wrap(name, fn));

  // Live games — every 15 seconds
  every('*/15 * * * * *', 'syncLiveGames', sync.syncLiveGames);
  every('*/15 * * * * *', 'syncLiveStats', sync.syncLiveStats);

  // Games, results, fixtures — every 60 seconds
  every('*/60 * * * * *', 'syncGames', sync.syncGames);
  every('*/60 * * * * *', 'syncGamesResults', sync.syncGamesResults);
  every('*/60 * * * * *', 'syncFixtures', sync.syncFixtures);

  // Standings, trends — every 2 minutes
  every('*/2 * * * *', 'syncStandings', sync.syncStandings);
  every('*/2 * * * *', 'syncTrends', sync.syncTrends);

  // Predictions, odds — every 5 minutes
  every('*/5 * * * *', 'syncPredictions', sync.syncPredictions);
  every('*/5 * * * *', 'syncOdds', sync.syncOdds);

  // Brackets, tournament stats, team of week, game details, outrights, venues, athletes — every 10 minutes
  every('*/10 * * * *', 'syncBrackets', sync.syncBrackets);
  every('*/10 * * * *', 'syncTournamentStats', sync.syncTournamentStats);
  every('*/10 * * * *', 'syncTeamOfWeek', sync.syncTeamOfWeek);
  every('*/10 * * * *', 'syncGameDetails', sync.syncGameDetails);
  every('*/10 * * * *', 'syncOutrights', sync.syncOutrights);
  every('*/10 * * * *', 'syncVenues', sync.syncVenues);
  every('*/10 * * * *', 'syncAthletes', sync.syncAthletes);

  // News — every 10 minutes
  every('*/10 * * * *', 'syncNews', sync.syncNews);

  // Suggestions (top upcoming games) — every 30 minutes (cambian poco)
  every('*/30 * * * *', 'syncSuggestions', sync.syncSuggestions);

  // Transfers (fichajes por equipo) — cada 6 horas (cambian lento)
  every('0 */6 * * *', 'syncTransfers', sync.syncTransfers);

  // Catalog and countries — every 6 hours
  every('0 */6 * * *', 'syncCatalog', sync.syncCatalog);
  every('0 */6 * * *', 'syncCountries', sync.syncCountries);

  // History — every 24 hours
  every('0 3 * * *', 'syncCompetitionHistory', sync.syncCompetitionHistory);

  log.info('Todos los cron jobs scheduleados (con guards anti-solapamiento). Servicio corriendo.');
}

main().catch(err => {
  log.error({ err }, 'Fatal error en sync');
  process.exit(1);
});
