/**
 * src/application/sync/syncService.js — Agregador de sync (Fase 7, Fase 4).
 *
 * `syncService` quedó "disuelto" en módulos por dominio (games, standings,
 * content, trendsOdds, details, catalog, athletes, transfers), todos sobre el
 * contexto compartido (`context.js`). Este archivo los reúne, define `syncAll`
 * (la corrida completa) y re-exporta la superficie que consumen el scheduler y
 * los tests.
 */

const games = require('./games');
const standings = require('./standings');
const content = require('./content');
const trendsOdds = require('./trendsOdds');
const details = require('./details');
const catalog = require('./catalog');
const athletes = require('./athletes');
const transfers = require('./transfers');
const { newSyncRunId, setSyncRunId, log } = require('./context');

async function syncAll() {
  setSyncRunId(newSyncRunId());
  log('Running full sync (multi-comp)...');
  try {
    await catalog.syncCatalog();
    await catalog.syncCountries();
    // games.syncGames() REMOVIDO en Fase 8.1 — bug: devolvía 0 games porque
    // usaba getGamesAllScores (global) con filtro por comp. syncGames ahora
    // es no-op alias; la cobertura se logra con syncFixtures + syncGamesResults.
    await games.syncLiveGames();
    await games.syncGamesResults();
    await games.syncFixtures();
    await standings.syncStandings();
    await content.syncBrackets();
    await content.syncTournamentStats();
    await content.syncTeamOfWeek();
    await content.syncCompetitionHistory();
    await content.syncNews();
    await trendsOdds.syncTrends();
    await trendsOdds.syncTrendDetails();
    await trendsOdds.syncPredictions();
    await trendsOdds.syncOutrights();
    await trendsOdds.syncOdds();
    // syncGameDetails REMOVIDO de syncAll() — Fase 8.1: este job es lento
    // (5 calls × 50 games = 250 requests) y se interbloquea con los crons
    // de live games via jobGuard. El cron de 10min lo cubre.
    await details.syncLiveStats();
    // syncAthletes REMOVIDO de syncAll() — Fase 8.1: 1108 athletes en serie
    // es muy lento y se interbloquea con los crons. El cron de 10min lo cubre.
    await athletes.syncVenues();
    await transfers.syncTransfers();
    await transfers.syncSuggestions();
    log('Full sync complete');
  } finally {
    setSyncRunId(null);
  }
}

module.exports = {
  ...games,
  ...standings,
  ...content,
  ...trendsOdds,
  ...details,
  ...catalog,
  ...athletes,
  ...transfers,
  syncAll,
};
