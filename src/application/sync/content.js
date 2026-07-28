/**
 * src/application/sync/content.js — Jobs de sync: brackets/stats/tow/history/news (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncBracketsForComp(comp) {
  if (!comp.hasBrackets) {
    log(`[comp=${comp.id}] Skipping brackets (not supported)`);
    return;
  }
  log(`[comp=${comp.id}] Fetching brackets...`);
  try {
    const data = await api.getBrackets(comp.id);
    const rows = [{
      competition_id: comp.id,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('brackets', 'competition_id', rows);
    log(`[comp=${comp.id}] Synced brackets`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing brackets: ${e.message}`);
  }
}

async function syncBrackets() {
  await forEachActive(syncBracketsForComp);
}

async function syncTournamentStatsForComp(comp) {
  log(`[comp=${comp.id}] Fetching tournament stats...`);
  try {
    const data = await api.getTournamentStats(comp.id, comp.seasonNum);
    const rows = [{
      competition_id: comp.id,
      season_num: comp.seasonNum,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('tournament_stats', ['competition_id', 'season_num'], rows);
    log(`[comp=${comp.id}] Synced tournament stats`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing tournament stats: ${e.message}`);
  }
}

async function syncTournamentStats() {
  await forEachActive(syncTournamentStatsForComp);
}

async function syncTeamOfWeekForComp(comp) {
  log(`[comp=${comp.id}] Fetching team of week...`);
  try {
    const data = await api.getTeamOfWeek(comp.id);
    const rows = [{
      competition_id: comp.id,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('team_of_week', 'competition_id', rows);
    log(`[comp=${comp.id}] Synced team of week`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing team of week: ${e.message}`);
  }
}

async function syncTeamOfWeek() {
  await forEachActive(syncTeamOfWeekForComp);
}

async function syncCompetitionHistoryForComp(comp) {
  if (!comp.hasHistory) {
    log(`[comp=${comp.id}] Skipping history (not supported)`);
    return;
  }
  log(`[comp=${comp.id}] Fetching competition history...`);
  try {
    const data = await api.getCompetitionHistory(comp.id);
    // El upstream 365scores usa DOS shapes distintos para history:
    //  - Mundial: { docs: [...] } con cada doc siendo una season completa
    //  - Ligas con tabla: { table: { rows: [{seasonNum, title, entityId, ...}, ...] } }
    // El shape `table.rows` es el más común; cada row es una entrada histórica
    // con `entityId` = campeón de esa temporada, `values` = stats.
    const docs = data?.docs ?? [];
    const tableRows = data?.table?.rows ?? [];
    const historyRows = [];

    if (docs.length) {
      for (const d of docs) {
        historyRows.push({
          competition_id: comp.id,
          season_num: d.seasonNum ?? null,
          champion_entity_id: d.entityId ?? null,
          title: d.title ?? null,
          // Stringify values para que pg reciba un JSON válido y no un array JS
          // (que pg serializa como array PG `{...}` y rompe el cast JSONB).
          values: d.values != null ? JSON.stringify(d.values) : null,
          data: JSON.stringify(d),
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (tableRows.length) {
      for (const r of tableRows) {
        historyRows.push({
          competition_id: comp.id,
          season_num: r.seasonNum ?? null,
          champion_entity_id: r.entityId ?? null,
          title: r.title ?? null,
          values: r.values != null ? JSON.stringify(r.values) : null,
          data: JSON.stringify(r),
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (historyRows.length) {
      await upsertMany('competition_history', ['competition_id', 'season_num'], historyRows);
    }
    log(`[comp=${comp.id}] Synced ${historyRows.length} history docs (${docs.length} docs + ${tableRows.length} table rows)`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing competition history: ${e.message}`);
  }
}

async function syncCompetitionHistory() {
  await forEachActive(syncCompetitionHistoryForComp);
}

async function syncNewsForComp(comp) {
  log(`[comp=${comp.id}] Fetching news...`);
  try {
    const data = await api.getNews('competition', comp.id);
    const items = data?.news ?? [];
    const rows = items.map(n => ({
      id: n.id,
      scope: 'competition',
      entity_id: comp.id,
      game_id: n.gameId ?? null,
      publish_date: n.publishDate ? new Date(n.publishDate).toISOString() : null,
      data: JSON.stringify(n),
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) await upsertMany('news', 'id', rows);
    log(`[comp=${comp.id}] Synced ${rows.length} news items`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing news: ${e.message}`);
  }
}

async function syncNews() {
  await forEachActive(syncNewsForComp);
}


module.exports = { syncBrackets, syncTournamentStats, syncTeamOfWeek, syncCompetitionHistory, syncNews };
