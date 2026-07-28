/**
 * src/application/sync/details.js — Jobs de sync: game details + live stats (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncGameDetailsForGame(gameId) {
  try {
    // 5 llamadas en paralelo: overview, h2h, prestats, lineups dedicados, stats.
    const [overview, h2h, preStats, lineups, stats] = await Promise.allSettled([
      api.getGameOverview(gameId),
      api.getGameH2H(gameId, undefined, true),
      api.getGamePreStats(gameId),
      api.getGameLineups(gameId),
      api.getGameStats(gameId),
    ]);

    if (overview.status === 'fulfilled') {
      const rows = [{
        game_id: gameId,
        data: JSON.stringify(overview.value),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('game_overviews', 'game_id', rows);
    }
    if (h2h.status === 'fulfilled') {
      const rows = [{
        game_id: gameId,
        data: JSON.stringify(h2h.value),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('game_h2h', 'game_id', rows);
    }
    if (preStats.status === 'fulfilled') {
      const rows = [{
        game_id: gameId,
        data: JSON.stringify(preStats.value),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('game_pre_stats', 'game_id', rows);
    }
    if (lineups.status === 'fulfilled' && lineups.value) {
      const rows = [{
        game_id: gameId,
        data: JSON.stringify(lineups.value),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('game_lineups', 'game_id', rows);
    }
    if (stats.status === 'fulfilled' && stats.value) {
      const lastUpdateId = stats.value.lastUpdateId || 0;
      const rows = [{
        game_id: gameId,
        last_update_id: lastUpdateId,
        data: JSON.stringify(stats.value),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('game_stats', 'game_id', rows);
    }
  } catch (e) {
    // Silently skip
  }
}

// Noticias especificas de un partido (scope='game').
async function syncGameNewsForGame(gameId) {
  try {
    const data = await api.getGameNews(gameId);
    const items = data?.news || [];
    if (!items.length) return;
    const rows = items.filter(n => n.id).map(n => ({
      id: n.id,
      scope: 'game',
      entity_id: gameId,
      game_id: gameId,
      publish_date: n.publishDate ? new Date(n.publishDate).toISOString() : null,
      data: JSON.stringify(n),
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) await upsertMany('news', 'id', rows);
  } catch (e) {
    // Silently skip
  }
}

async function syncGameDetails() {
  log('Fetching game details (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const rows = await db.execAdvanced(
      `SELECT id FROM games WHERE competition_id = ANY($1::int[]) AND status_group IN (1, 2, 4)
       ORDER BY start_time DESC LIMIT 50`,
      [ids]
    );
    let count = 0;
    for (const { id } of rows) {
      await syncGameDetailsForGame(id);
      await syncGameNewsForGame(id);
      count++;
    }
    log(`Synced details for ${count} games`);
  } catch (e) {
    logErr(`Error syncing game details: ${e.message}`);
  }
}

async function syncLiveStats() {
  log('Fetching live stats (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const rows = await db.execAdvanced(
      'SELECT id FROM games WHERE competition_id = ANY($1::int[]) AND status_group = 1',
      [ids]
    );
    let count = 0;
    for (const { id } of rows) {
      try {
        const data = await api.getGameStats(id);
        const lastUpdateId = data?.lastUpdateId ?? 0;
        const rows_ = [{
          game_id: id,
          last_update_id: lastUpdateId,
          data: JSON.stringify(data),
          updated_at: new Date().toISOString(),
        }];
        await upsertMany('game_stats', 'game_id', rows_);
        count++;
      } catch (_) { /* skip */ }
    }
    log(`Synced live stats for ${count} games`);
  } catch (e) {
    logErr(`Error syncing live stats: ${e.message}`);
  }
}

/**
 * syncCatalog guarda el detalle de cada comp en la tabla `competitions`
 * (catálogo upstream) y reconstruye `competitors` desde standings + top.
 */

module.exports = { syncGameDetails, syncGameDetailsForGame, syncGameNewsForGame, syncLiveStats };
