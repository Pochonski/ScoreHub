/**
 * src/application/sync/catalog.js — Jobs de sync: catalog + countries (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncCatalog() {
  log('Syncing catalog (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);

    // 1. Llamar `getCompetition(id)` en paralelo para todas las activas.
    const compResults = await Promise.allSettled(
      comps.map(c => api.getCompetition(c.id))
    );

    const compRows = [];
    const competitorsByComp = new Map(); // competitorId -> { competitor, competitionId }

    for (let i = 0; i < compResults.length; i++) {
      const r = compResults[i];
      const comp = comps[i];
      if (r.status !== 'fulfilled') {
        log(`[comp=${comp.id}] getCompetition failed:`, r.reason?.message);
        continue;
      }
      const list = r.value?.competitions || [];
      const upstreamComp = list[0];
      if (upstreamComp) {
        compRows.push({
          id: upstreamComp.id,
          data: JSON.stringify(r.value),
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (compRows.length) {
      await upsertMany('competitions', 'id', compRows);
    }

    // 2. Standings por comp (source of truth para los competidores).
    const standingsResults = await Promise.allSettled(
      comps.map(c => api.getStandings(c.id, 1, c.seasonNum))
    );
    for (let i = 0; i < standingsResults.length; i++) {
      const r = standingsResults[i];
      const comp = comps[i];
      if (r.status !== 'fulfilled') {
        log(`[comp=${comp.id}] getStandings failed:`, r.reason?.message);
        continue;
      }
      const stages = r.value?.standings ?? [];
      for (const stage of stages) {
        for (const row of stage.rows ?? []) {
          const c = row.competitor;
          if (!c || !c.id) continue;
          const cid = c.mainCompetitionId ?? c.competitionId ?? null;
          competitorsByComp.set(c.id, { competitor: c, competitionId: cid });
          // Force compId para esta comp si upstream devolvió null.
          const v = competitorsByComp.get(c.id);
          if (v.competitionId == null) v.competitionId = comp.id;
        }
      }
    }

    // 3. Top competitors (clubs, ligas) merge.
    try {
      const topData = await api.getTopCompetitors(300);
      for (const c of topData?.competitors ?? []) {
        if (!competitorsByComp.has(c.id)) {
          competitorsByComp.set(c.id, { competitor: c, competitionId: c.competitionId ?? null });
        }
      }
    } catch (_) { /* skip */ }

    // 4. Persistir competidores (replace por active comp ids) — atomic.
    if (competitorsByComp.size) {
      const rows = [];
      for (const { competitor, competitionId } of competitorsByComp.values()) {
        rows.push({
          id: competitor.id,
          competition_id: competitionId,
          name: competitor.name ?? null,
          data: JSON.stringify(competitor),
          updated_at: new Date().toISOString(),
        });
      }
      // Solo borramos competidores de competiciones activas; respetamos los
      // de competiciones históricas que el historial pueda necesitar.
      // Todo el replace (DELETE + INSERT) ocurre dentro de una transacción
      // para que un crash a mitad no deje la tabla inconsistente.
      try {
        await withTransaction(async (client) => {
          await client.query(
            'DELETE FROM competitors WHERE competition_id = ANY($1::int[])',
            [ids]
          );
          for (const row of rows) {
            await upsertCompetitorCanonical(client, row);
          }
        });
        // Re-syncing competition_competitors — when competitors get rebuilt
        // their relation to the comp might have shifted. We keep the
        // season-specific entries from games/standings sync that ran earlier
        // in this boot, but add a fresh upsert for the season that's passed
        // through forEachActive so the junction stays current.
        // Only upsert, never DELETE — historical rows from past syncs survive.
        for (const c of comps) {
          const compData = competitorsByComp.get(c.id);
          if (compData) {
            // Best-effort: insert from catalog so competition_competitors has
            // a "catalog-source" hint for the active season.
            await pool.query(
              `INSERT INTO competition_competitors
                (competition_id, competitor_id, season_num, source, last_seen_at)
               VALUES ($1, $2, $3, 'sync', now())
               ON CONFLICT (competition_id, competitor_id, season_num)
               DO UPDATE SET last_seen_at = now()`,
              [c.id, Number(compData.competitor.id), c.seasonNum]
            );
          }
        }
      } catch (err) {
        logErr(`catalog competitors txn failed: ${err.message}`);
      }
    }

    log(`Synced catalog (${compRows.length} competitions, ${competitorsByComp.size} competitors, atomic)`);
  } catch (e) {
    logErr(`Error syncing catalog: ${e.message}`);
  }
}

async function syncCountries() {
  log('Syncing countries...');
  try {
    const data = await api.getTopCompetitors(300);
    const list = data?.countries ?? [];
    const countries = new Map();
    for (const c of list) {
      if (c.id && !countries.has(c.id)) {
        countries.set(c.id, c);
      }
    }
    if (countries.size === 0) {
      const sports = data?.sports ?? [];
      for (const sport of sports) {
        for (const c of (sport.competitors ?? [])) {
          if (c.countryId && !countries.has(c.countryId)) {
            countries.set(c.countryId, { id: c.countryId, name: c.countryName ?? null });
          }
        }
      }
    }
    const rows = Array.from(countries.values()).map(c => ({
      id: c.id,
      name: c.name ?? null,
      data: JSON.stringify(c),
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await upsertMany('countries', 'id', rows);
    }
    log(`Synced ${rows.length} countries`);
  } catch (e) {
    logErr(`Error syncing countries: ${e.message}`);
  }
}


module.exports = { syncCatalog, syncCountries };
