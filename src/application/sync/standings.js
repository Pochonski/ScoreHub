/**
 * src/application/sync/standings.js — Jobs de sync: standings (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncStandingsForComp(comp) {
  log(`[comp=${comp.id}] Fetching standings...`);
  try {
    // Pedimos type=2 (Apertura) para la Liga Promerica, type=1 (overall)
    // para el Mundial. El upstream detecta la "current stage" por season.
    const typesToFetch = [1, 2]; // overall + apertura
    const stagesByType = new Map();

    for (const type of typesToFetch) {
      try {
        const data = await api.getStandings(comp.id, type, comp.seasonNum, { type });
        if (data?.standings?.length) {
          stagesByType.set(type, data);
        }
      } catch (_) {
        // some comps might not have a stage for this type
      }
    }

    // Persistir cada stage (PK es competition_id+stage_num+season_num).
    for (const [type, data] of stagesByType) {
      const rows = [{
        competition_id: comp.id,
        stage_num: type,
        season_num: comp.seasonNum,
        data: JSON.stringify(data),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('standings', ['competition_id', 'stage_num', 'season_num'], rows);
      // Mantiene la junction table sincronizada con los competidores del stage.
      if (Array.isArray(data?.standings)) {
        await upsertCompetitionCompetitorsFromStandings(comp.id, comp.seasonNum, data.standings);
      }
    }

    // Fetch con withSeasonsFilter=true una vez para guardar seasonsFilter.
    try {
      const sf = await api.getStandings(comp.id, 1, comp.seasonNum, { withSeasonsFilter: true });
      if (sf?.seasonsFilter) {
        const rows = [{
          competition_id: comp.id,
          stage_num: 1,
          season_num: comp.seasonNum,
          data: JSON.stringify(sf),
          updated_at: new Date().toISOString(),
        }];
        await upsertMany('standings', ['competition_id', 'stage_num', 'season_num'], rows);
        if (Array.isArray(sf?.standings)) {
          await upsertCompetitionCompetitorsFromStandings(comp.id, comp.seasonNum, sf.standings);
        }
      }
    } catch (_) { /* not critical */ }

    log(`[comp=${comp.id}] Synced standings (${stagesByType.size} stages)`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing standings: ${e.message}`);
  }
}

async function syncStandings() {
  await forEachActive(syncStandingsForComp);
}


module.exports = { syncStandings };
