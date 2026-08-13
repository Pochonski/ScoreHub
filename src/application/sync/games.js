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
  return Promise.resolve();
}

/**
 * Auditoría 2026-Q3 Fase 5.2: syncGames() ya no es invocado por syncAll().
 * Mantenido como no-op explícito para retrocompatibilidad con tests que lo
 * importan. Loguea un warning para visibilidad si alguien lo llama por error.
 * @deprecated Use syncFixtures() + syncGamesResults() directamente.
 */
async function syncGames() {
  log('syncGames() is deprecated — use syncFixtures() + syncGamesResults()');
  return { ok: 0, skipped: true, reason: 'deprecated alias' };
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
