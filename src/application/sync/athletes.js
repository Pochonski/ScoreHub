/**
 * src/application/sync/athletes.js — Jobs de sync: athletes + venues (Fase 7, Fase 4).
 * Extraído verbatim de syncService.js; usa el contexto compartido.
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

async function syncAthletes() {
  log('Syncing athletes (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);

    const rows = await db.execAdvanced(
      `SELECT gl.data AS lineups
         FROM game_lineups gl
         JOIN games g ON g.id = gl.game_id
        WHERE g.competition_id = ANY($1::int[])`,
      [ids]
    );

    const seen = new Set();
    const athleteIds = [];
    for (const r of rows) {
      const members = r.lineups?.members || [];
      for (const m of members) {
        const aid = Number(m.athleteId ?? m.id);
        if (!Number.isFinite(aid) || seen.has(aid)) continue;
        seen.add(aid);
        athleteIds.push({ id: aid, name: m.name ?? m.shortName ?? null, rosterMember: m });
      }
    }

    if (!athleteIds.length) {
      log('No athletes discovered in game overviews; skipping.');
      return;
    }

    const canonicalIds = athleteIds.map((a) => a.id);

    // Limpieza de filas roster-id stale + roster upsert atómico.
    // upsertRosterMembership NO sobreescribe filas con source='profile'.
    await withTransaction(async (client) => {
      const { rowCount: staleDeleted } = await client.query(
        `DELETE FROM athletes
          WHERE id <> canonical_id
            AND canonical_id = ANY($1::bigint[])`,
        [canonicalIds]
      );
      if (staleDeleted > 0) {
        log(`Removed ${staleDeleted} stale roster-id rows before upsert`);
      }
      for (const a of athleteIds) {
        await upsertRosterMembership(client, a.id, a.name);
      }
    });
    log(`Synced ${athleteIds.length} athlete roster rows (atomic)`);

    const STALE_AFTER_MS = require('../../infrastructure/config').helpers.athleteStaleAfterMs();
    const freshRows = await db.execAdvanced(
      `SELECT id, updated_at,
              (data ? 'trophies') AS has_trophies,
              (data ? 'transfers') AS has_transfers,
              (data ? 'careerStats') AS has_career
         FROM athletes
        WHERE id = ANY($1::bigint[])`,
      [athleteIds.map((a) => a.id)]
    );
    const freshMap = new Map(freshRows.map((r) => [Number(r.id), r]));
    const cutoff = Date.now() - STALE_AFTER_MS;

    let hydrated = 0;
    let skipped = 0;
    for (const { id } of athleteIds) {
      const cached = freshMap.get(id);
      const updatedTs = cached?.updated_at ? new Date(cached.updated_at).getTime() : 0;
      const isFresh =
        cached &&
        updatedTs >= cutoff &&
        cached.has_trophies &&
        cached.has_transfers &&
        cached.has_career;
      if (isFresh) { skipped++; continue; }

      try {
        const res = await api.getAthlete(id, true);
        const a = res?.athletes?.[0];
        if (!a || !a.id) { skipped++; continue; }
        const normalized = { ...a, id: Number(a.id) };
        // Cada hidratación individual es atómica (un solo upsert).
        await withTransaction(async (client) => {
          await upsertAthleteCanonical(client, {
            id: normalized.id,
            name: normalized.name ?? null,
            data: JSON.stringify(normalized),
          });
        });
        hydrated++;
      } catch (e) {
        logErr(`  hydrate ${id} failed: ${e.message}`);
      }
    }

    log(`Hydrated ${hydrated} profiles, skipped ${skipped} (fresh or upstream-error)`);
  } catch (e) {
    logErr(`Error syncing athletes: ${e.message}`);
  }
}

async function syncVenues() {
  log('Syncing venues (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const rows = await db.execAdvanced(
      `SELECT data FROM game_overviews
        WHERE game_id IN (SELECT id FROM games WHERE competition_id = ANY($1::int[]))`,
      [ids]
    );
    const seen = new Set();
    const venues = [];
    for (const r of rows) {
      const venue = r.data?.game?.venue;
      if (!venue?.id || seen.has(venue.id)) continue;
      seen.add(venue.id);
      venues.push({
        id: venue.id,
        name: venue.name ?? null,
        city: venue.city ?? null,
        country_id: venue.countryId ?? null,
        capacity: venue.capacity ?? null,
        data: JSON.stringify(venue),
        updated_at: new Date().toISOString(),
      });
    }
    for (const row of venues) {
      await upsertMany('venues', 'id', [row]);
    }
    log(`Synced ${venues.length} venues`);
  } catch (e) {
    logErr(`Error syncing venues: ${e.message}`);
  }
}

/**
 * syncTransfers: cachea los fichajes por competición. Usa la tabla
 * `competition_transfers` con PK (competition_id, transfer_id). El `athleteId`
 * se guarda en `athlete_id` para joins con la tabla `athletes`.
 */

module.exports = { syncAthletes, syncVenues };
