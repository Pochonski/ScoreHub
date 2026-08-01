/**
 * src/application/sync/transfers.js — Jobs de sync: transfers + suggestions (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncTransfersForComp(comp) {
  log(`[comp=${comp.id}] Fetching transfers...`);
  try {
    const data = await api.getTransfers(comp.id, { limit: 100 });
    const transfers = data?.transfers ?? [];
    const athletes = data?.athletes ?? [];
    const competitors = data?.competitors ?? [];

    // All of this is now atomic: if anything fails mid-way the DELETE+INSERT
    // doesn't leave the cache half-populated.
    await withTransaction(async (client) => {
      // Upsert athletes que aparezcan en transfers como REFERENCIA — no
      // destruye perfiles canónicos ya almacenados (source='profile').
      if (athletes.length) {
        const seen = new Set();
        for (const a of athletes) {
          const id = Number(a.id);
          if (!Number.isFinite(id) || seen.has(id)) continue;
          seen.add(id);
          await upsertRosterMembership(client, id, a.name ?? null);
        }
      }

      // Upsert competitors externos que aparezcan en transfers como
      // REFERENCIA — preserva el `data` canónico del equipo. No toca
      // competition_id.
      if (competitors.length) {
        const seenIds = new Set();
        for (const c of competitors) {
          const id = Number(c.id);
          if (!Number.isFinite(id) || seenIds.has(id)) continue;
          seenIds.add(id);
          await upsertCompetitorReference(client, id, c.name ?? null);
        }
      }

      // Asegurar que todo equipo referenciado en transfers tenga un registro
      // en `competitors` (aunque sea mínimo) — usando la versión reference
      // para no destruir datos canónicos.
      const allTeamIds = new Set();
      for (const t of transfers) {
        if (t.origin != null) allTeamIds.add(Number(t.origin));
        if (t.target != null) allTeamIds.add(Number(t.target));
      }
      const knownIds = new Set(competitors.map((c) => Number(c.id)));
      for (const id of allTeamIds) {
        if (!knownIds.has(id)) {
          await upsertCompetitorReference(client, id);
        }
      }

      // Replace transfers de esta comp (DELETE + INSERT atómico).
      await client.query(
        `DELETE FROM competition_transfers WHERE competition_id = $1`,
        [comp.id]
      );
      if (transfers.length) {
        const rows = transfers.map(t => ({
          competition_id: comp.id,
          transfer_id: Number(t.id),
          athlete_id: t.athleteId != null ? Number(t.athleteId) : null,
          origin_id: t.origin != null ? Number(t.origin) : null,
          target_id: t.target != null ? Number(t.target) : null,
          time: t.time ?? null,
          price: t.price ?? null,
          position_id: t.positionId != null ? Number(t.positionId) : null,
          is_arrival: !!t.isArrival,
          is_departure: !!t.isDeparture,
          status_id: t.statusId != null ? Number(t.statusId) : null,
          status_name: t.statusName ?? null,
          data: JSON.stringify(t),
          updated_at: new Date().toISOString(),
        }));
        const keys = Object.keys(rows[0]);
        const placeholders = rows.map((_, ri) =>
          '(' + keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ') + ')'
        ).join(', ');
        const values = rows.flatMap(r => keys.map(k => r[k]));
        await client.query(
          `INSERT INTO competition_transfers (${keys.join(', ')}) VALUES ${placeholders}`,
          values
        );
      }
    });

    log(`[comp=${comp.id}] Synced ${transfers.length} transfers, ${athletes.length} athletes (atomic)`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing transfers: ${e.message}`);
  }
}

async function syncTransfers() {
  log('Syncing transfers (multi-comp)...');
  await forEachActive(syncTransfersForComp);
}

/**
 * syncSuggestions: cachea sugerencias de partidos (top upcoming games con
 * valor de apuesta). Tabla `game_suggestions` con PK `game_id`.
 */
async function syncSuggestionsForComp(comp) {
  log(`[comp=${comp.id}] Fetching game suggestions...`);
  try {
    const data = await api.getGameSuggestions(comp.id);
    const suggested = data?.suggestedGames ?? [];

    await withTransaction(async (client) => {
      // Atomic: clear stale rows before inserting fresh ones.
      await client.query(
        `DELETE FROM game_suggestions WHERE competition_id = $1`,
        [comp.id]
      );
      if (!suggested.length) return;

      const rows = suggested.map(g => ({
        game_id: Number(g.id),
        competition_id: comp.id,
        rank: g.rank ?? null,
        data: JSON.stringify(g),
        updated_at: new Date().toISOString(),
      }));
      const keys = Object.keys(rows[0]);
      const placeholders = rows.map((_, ri) =>
        '(' + keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ') + ')'
      ).join(', ');
      const values = rows.flatMap(r => keys.map(k => r[k]));
      await client.query(
        `INSERT INTO game_suggestions (${keys.join(', ')}) VALUES ${placeholders}`,
        values
      );
    });

    log(`[comp=${comp.id}] Synced ${suggested.length} suggestions (atomic)`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing suggestions: ${e.message}`);
  }
}

async function syncSuggestions() {
  log('Syncing suggestions (multi-comp)...');
  await forEachActive(syncSuggestionsForComp);
}


module.exports = { syncTransfers, syncTransfersForComp, syncSuggestions, syncSuggestionsForComp };
