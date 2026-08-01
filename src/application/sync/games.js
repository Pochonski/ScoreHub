/**
 * src/application/sync/games.js — Jobs de sync: games/live/results/fixtures (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncGamesForComp(comp) {
  // Fase 8.1 — REMOVED syncGames via getGamesAllScores (bug: devolvía 0 games
  // porque filtra comps específicas de un feed global que no las incluye).
  // La cobertura se logra con:
  //   - syncLiveGames (games.status_group=1)
  //   - syncFixtures (games.status_group=2 via getFixtures per-comp)
  //   - syncGamesResults (games.status_group=4 via getGamesResults per-comp)
  // syncGames queda como alias de syncFixtures + syncGamesResults para mantener
  // compatibilidad con el scheduler y tests.
  return Promise.resolve();
}

async function syncGames() {
  // syncAll() en syncService.js sigue invocándolo en orden, pero la lógica
  // per-comp se delega a syncFixtures y syncGamesResults (cron jobs separados).
  log('syncGames: alias of syncFixtures + syncGamesResults (no-op)');
}

async function syncLiveGamesForComp(comp) {
  log(`[comp=${comp.id}] Fetching live games...`);
  try {
    const data = await api.getGamesCurrent(comp.id);
    const games = data?.games ?? [];
    await upsertGames(games);
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} live games`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing live games: ${e.message}`);
  }
}

async function syncLiveGames() {
  await forEachActive(syncLiveGamesForComp);
}

async function syncGamesResultsForComp(comp) {
  log(`[comp=${comp.id}] Fetching results...`);
  try {
    const data = await api.getGamesResults(comp.id);
    const games = data?.games ?? [];
    await upsertGames(games);
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} results`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing results: ${e.message}`);
  }
}

async function syncGamesResults() {
  await forEachActive(syncGamesResultsForComp);
}

async function syncFixturesForComp(comp) {
  log(`[comp=${comp.id}] Fetching fixtures...`);
  try {
    const data = await api.getFixtures(comp.id);
    const games = data?.games ?? [];
    await upsertGames(games);
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} fixtures`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing fixtures: ${e.message}`);
  }
}

async function syncFixtures() {
  await forEachActive(syncFixturesForComp);
}


module.exports = { syncGames, syncLiveGames, syncGamesResults, syncFixtures };
