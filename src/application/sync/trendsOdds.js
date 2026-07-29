/**
 * src/application/sync/trendsOdds.js — Jobs de sync: trends/predictions/odds/outrights (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncTrendsForComp(comp) {
  log(`[comp=${comp.id}] Fetching trends...`);
  try {
    const data = await api.getTrends('competition', comp.id);
    const items = data?.trends ?? [];
    const rows = items.map(t => ({
      scope: 'competition',
      entity_id: comp.id,
      game_id: t.gameId ?? t.homeTeamGameId ?? null,
      line_type_id: t.lineTypeId ?? null,
      data: JSON.stringify(t),
      updated_at: new Date().toISOString(),
    }));

    await withTransaction(async (client) => {
      await client.query(
        'DELETE FROM trends WHERE scope = $1 AND entity_id = $2',
        ['competition', comp.id]
      );
      if (rows.length) {
        const placeholders = rows.map((_, i) =>
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
        ).join(', ');
        const values = rows.flatMap(r => [r.scope, r.entity_id, r.game_id, r.line_type_id, r.data]);
        await client.query(
          `INSERT INTO trends (scope, entity_id, game_id, line_type_id, data) VALUES ${placeholders}`,
          values
        );
      }
    });

    log(`[comp=${comp.id}] Synced ${rows.length} trends (atomic)`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing trends: ${e.message}`);
  }
}

async function syncTrends() {
  await forEachActive(syncTrendsForComp);
}

async function syncPredictions() {
  // La API de 365scores devuelve las predicciones dentro de cada game:
  //   data.games[i].promotedPredictions.predictions[]
  // no en un array top-level `data.predictions`.
  //
  // Filtramos para guardar solo predicciones de games que estén en la
  // tabla `games` (i.e. competiciones activas en active_competitions) —
  // así el comando `/predicciones <id>` solo intenta mostrar datos
  // relevantes para el usuario.
  log('Fetching predictions...');
  try {
    const data = await api.getPredictions(1);
    const games = data?.games ?? [];
    if (!games.length) {
      log('Synced 0 predictions (no games in upstream response)');
      return;
    }

    // Construir map gameId -> {gameId, data} con las predicciones.
    const rows = [];
    for (const g of games) {
      const gid = g.id;
      const pp = g.promotedPredictions;
      if (!pp || !Array.isArray(pp.predictions) || !pp.predictions.length) continue;
      rows.push({
        game_id: gid,
        data: JSON.stringify(g), // guarda el game completo (incluye promotedPredictions)
        updated_at: new Date().toISOString(),
      });
    }
    if (!rows.length) {
      log('Synced 0 predictions (none with promotedPredictions)');
      return;
    }

    // Filtrar por games en competiciones activas (no insertar basura
    // de games que no están en nuestra DB).
    const gameIds = rows.map(r => r.game_id);
    const existing = await db.execAdvanced(
      `SELECT id FROM games WHERE id = ANY($1::bigint[])`,
      [gameIds]
    );
    const existingIds = new Set(existing.map(r => Number(r.id)));
    const filteredRows = rows.filter(r => existingIds.has(Number(r.game_id)));
    if (!filteredRows.length) {
      log(`Synced 0 predictions (none of ${rows.length} upstream games are in our DB)`);
      return;
    }

    await upsertMany('predictions', 'game_id', filteredRows);
    log(`Synced ${filteredRows.length} predictions (${rows.length - filteredRows.length} filtered out)`);
  } catch (e) {
    logErr(`Error syncing predictions: ${e.message}`);
  }
}

async function syncOddsForGame(gameId) {
  try {
    const data = await api.getOddsLines(gameId);
    const rows = [{
      game_id: gameId,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('odds_lines', 'game_id', rows);
  } catch (e) {
    // Silently skip — some games may not have odds
  }
}

// Odds se syncen por partido; los partidos pertenecen a competiciones
// activas. Filtramos los IDs de games de las competiciones activas.
async function syncOdds() {
  log('Fetching odds for active games...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const rows = await db.execAdvanced(
      `SELECT id FROM games WHERE competition_id = ANY($1::int[]) AND status_group IN (1, 2)
       ORDER BY start_time DESC LIMIT 30`,
      [ids]
    );
    let count = 0;
    for (const { id } of rows) {
      await syncOddsForGame(id);
      count++;
    }
    log(`Synced odds for ${count} games`);
  } catch (e) {
    logErr(`Error syncing odds: ${e.message}`);
  }
}

async function syncOutrightsForComp(comp) {
  log(`[comp=${comp.id}] Fetching outrights...`);
  try {
    const data = await api.getOutrights(comp.id);
    const rows = [{
      competition_id: comp.id,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('odds_outrights', 'competition_id', rows);
    log(`[comp=${comp.id}] Synced outrights`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing outrights: ${e.message}`);
  }
}

async function syncOutrights() {
  await forEachActive(syncOutrightsForComp);
}


module.exports = { syncTrends, syncPredictions, syncOdds, syncOutrights };
