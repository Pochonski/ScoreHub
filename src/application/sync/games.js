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
  log(`[comp=${comp.id}] Fetching all games (${comp.startDate || 'auto'} - ${comp.endDate || 'auto'})...`);
  try {
    // 365scores pide YYYYMMDD. Si la comp no tiene fechas, usamos una
    // ventana generosa (3 meses atrás hasta 6 meses adelante).
    const now = new Date();
    const startDate = comp.startDate || new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const endDate = comp.endDate || new Date(now.getTime() + 180 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const data = await api.getGamesAllScores(startDate, endDate, 1, {
      onlyMajorGames: true,
      withTop: true,
      showOdds: true,
    });
    const games = (data?.games ?? []).filter(g => Number(g.competitionId) === comp.id);
    await upsertGames(games);
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} games`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing games: ${e.message}`);
  }
}

async function syncGames() {
  log('Fetching all games (multi-comp)...');
  await forEachActive(syncGamesForComp);
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
