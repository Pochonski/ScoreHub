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

/**
 * syncGameTrends — trends por PARTIDO (scope='game').
 *
 * El feed competition-level (getTrends('competition', id) usa isTop=true) solo
 * trae el trend "top" por partido — uno, a veces duplicado. El feed game-level
 * (getTrends('game', gameId)) trae TODOS los tips del partido: ganador,
 * over/under, ambos marcan, primer gol, resultado del 1er tiempo, etc.
 *
 * Poblamos scope='game' para los próximos partidos (status_group 1=live,
 * 2=upcoming) de las comps activas. El endpoint /matches/:id/tips ya lee
 * scope IN ('competition','game') y prefiere los game-level.
 *
 * Cobertura POR COMPETICIÓN: tomamos los próximos GAMES_PER_COMP partidos de
 * CADA comp (no un top-N global). Con un LIMIT global las ligas cuyos partidos
 * están más lejos (ej. las europeas fuera de temporada) quedaban sin tips.
 */
const GAMES_PER_COMP = 8;

async function syncGameTrends() {
  log('Fetching per-game trends (upcoming)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const games = await db.execAdvanced(
      `SELECT id FROM (
         SELECT id,
                row_number() OVER (PARTITION BY competition_id ORDER BY start_time ASC) AS rn
           FROM games
          WHERE competition_id = ANY($1::int[])
            AND status_group IN (1, 2)
       ) q
       WHERE rn <= $2`,
      [ids, GAMES_PER_COMP]
    );

    let totalRows = 0;
    let gamesWithTips = 0;
    for (const g of games) {
      const gid = Number(g.id);
      try {
        const data = await api.getTrends('game', gid);
        const items = data?.trends ?? [];
        const rows = items.map(t => ({
          scope: 'game',
          entity_id: gid,
          game_id: t.gameId ?? gid,
          line_type_id: t.lineTypeId ?? null,
          data: JSON.stringify(t),
        }));

        await withTransaction(async (client) => {
          await client.query('DELETE FROM trends WHERE scope = $1 AND game_id = $2', ['game', gid]);
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

        if (rows.length) { totalRows += rows.length; gamesWithTips++; }
      } catch (e) {
        logErr(`[game=${gid}] Error syncing game trends: ${e.message}`);
      }
    }

    log(`Synced ${totalRows} per-game trends across ${gamesWithTips}/${games.length} games`);
  } catch (e) {
    logErr(`Error syncing game trends: ${e.message}`);
  }
}

async function syncPredictions() {
  // La API de 365scores devuelve las predicciones dentro de cada game:
  //   data.games[i].promotedPredictions.predictions[]
  // no en un array top-level `data.predictions`.
  //
  // Fase 8.6 — fix: el feed de predictions SIEMPRE devuelve los mismos 5
  // games de "amistosos pre-temporada" (comp 321). Esos games no están en
  // nuestra tabla `games` (porque sus competiciones no son activas), pero
  // muchos de SUS competidores SÍ están en `competitors` (Manchester City,
  // Inter, Barcelona, etc.). Antes descartábamos todos. Ahora guardamos
  // predictions de games cuyo home_competitor_id O away_competitor_id
  // esté en `competitors` — así los usuarios ven predicciones de partidos
  // relevantes (amistosos de sus equipos) incluso si la competición no
  // está activa.
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
    const candidateCompetitorIds = new Set();
    for (const g of games) {
      const gid = g.id;
      const pp = g.promotedPredictions;
      if (!pp || !Array.isArray(pp.predictions) || !pp.predictions.length) continue;
      rows.push({
        game_id: gid,
        data: JSON.stringify(g),
        updated_at: new Date().toISOString(),
      });
      const homeId = g.homeCompetitor?.id;
      const awayId = g.awayCompetitor?.id;
      if (homeId != null) candidateCompetitorIds.add(Number(homeId));
      if (awayId != null) candidateCompetitorIds.add(Number(awayId));
    }
    if (!rows.length) {
      log('Synced 0 predictions (none with promotedPredictions)');
      return;
    }

    // Filtrar por games cuyos competidores SÍ estén en `competitors`.
    // Esto acepta games de competiciones no activas pero con equipos
    // relevantes (e.g. Manchester City jugando un amistoso).
    const compIds = Array.from(candidateCompetitorIds);
    let knownCompetitorIds = new Set();
    if (compIds.length) {
      const existing = await db.execAdvanced(
        `SELECT id FROM competitors WHERE id = ANY($1::bigint[])`,
        [compIds]
      );
      knownCompetitorIds = new Set(existing.map(r => Number(r.id)));
    }

    const filteredRows = rows.filter(r => {
      try {
        const g = JSON.parse(r.data);
        const homeId = Number(g.homeCompetitor?.id);
        const awayId = Number(g.awayCompetitor?.id);
        return knownCompetitorIds.has(homeId) || knownCompetitorIds.has(awayId);
      } catch (_) {
        return false;
      }
    });

    if (!filteredRows.length) {
      log(`Synced 0 predictions (none of ${rows.length} upstream games have competitors in our DB)`);
      return;
    }

    await upsertMany('predictions', 'game_id', filteredRows);
    log(`Synced ${filteredRows.length} predictions (${rows.length - filteredRows.length} filtered out — competitors not in DB)`);
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

/**
 * syncTrendDetails — puebla `trend_details` desde los trend_ids conocidos
 * en `trends`. Solo hidrata los que están stale (> 30 min) o no existen.
 *
 * Reemplaza al endpoint `GET /trends/details?trendId=X` que iba directo
 * a 365scores en cada request (Fase 8.3).
 */
async function syncTrendDetails() {
  log('Hydrating trend_details (stale or missing)...');
  try {
    // Tomamos trend_ids únicos de la tabla `trends` (los que tienen lineTypeId
    // son los "promoted" — los que el dashboard puede pedir).
    const trendIds = await db.execAdvanced(
      `SELECT DISTINCT (data->>'id')::int AS trend_id
         FROM trends
        WHERE data->>'id' IS NOT NULL
          AND line_type_id IS NOT NULL`
    );
    if (!trendIds.length) {
      log('No trends to hydrate (trends table empty or no lineTypeId)');
      return;
    }
    const ids = trendIds.map(r => r.trend_id).filter(Number.isFinite);

    // Filtramos los que necesitan hidratación (no existen o > 30min).
    const cutoffIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const staleIds = await db.execAdvanced(
      `SELECT id FROM (
         SELECT unnest($1::int[]) AS id
       ) s
       WHERE NOT EXISTS (
         SELECT 1 FROM trend_details t
          WHERE t.trend_id = s.id
            AND t.updated_at > $2::timestamptz
       )`,
      [ids, cutoffIso]
    );
    const toHydrate = staleIds.map(r => Number(r.id));
    if (!toHydrate.length) {
      log(`All ${ids.length} trend_details are fresh (skip)`);
      return;
    }

    let hydrated = 0;
    let failed = 0;
    for (const tid of toHydrate) {
      try {
        const data = await api.getTrendDetails(tid);
        if (!data?.trend?.id) { failed++; continue; }
        await upsertMany('trend_details', 'trend_id', [{
          trend_id: Number(data.trend.id),
          data: JSON.stringify(data),
          updated_at: new Date().toISOString(),
        }]);
        hydrated++;
      } catch (e) {
        failed++;
        logErr(`  trend ${tid} hydrate failed: ${e.message}`);
      }
    }
    log(`Hydrated ${hydrated} trend_details (${failed} failed, ${ids.length - toHydrate.length} fresh)`);
  } catch (e) {
    logErr(`Error syncing trend details: ${e.message}`);
  }
}


module.exports = { syncTrends, syncGameTrends, syncPredictions, syncOdds, syncOutrights, syncTrendDetails };
