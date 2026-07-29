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
    await games.syncGames();
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
    await details.syncGameDetails();
    await details.syncLiveStats();
    await athletes.syncAthletes();
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
