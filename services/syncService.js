require('dotenv').config();
const api = require('./scores365Service');
const { pool } = require('../database/connection');
const { getActiveCompetitions, forEachActive } = require('./syncCompetitions');

const LOG_PREFIX = '[Sync]';

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

async function upsertMany(table, conflictCols, rows) {
  if (!rows.length) return;
  const conflictArr = Array.isArray(conflictCols) ? conflictCols : [conflictCols];
  const keys = Object.keys(rows[0]);
  const placeholders = rows.map((_, ri) =>
    '(' + keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ') + ')'
  ).join(', ');

  const conflictClause = conflictArr.join(', ');
  const updates = keys
    .filter(k => !conflictArr.includes(k))
    .map(k => `${k} = EXCLUDED.${k}`)
    .join(', ');

  const values = rows.flatMap(r => keys.map(k => r[k]));

  const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT (${conflictClause}) DO UPDATE SET ${updates}`;
  await pool.query(query, values);
}

async function upsertGames(games) {
  if (!games?.length) return;
  const rows = games.map(g => ({
    id: g.id,
    competition_id: g.competitionId ?? null,
    status_group: g.statusGroup ?? null,
    status_text: g.statusText ?? null,
    start_time: g.startTime ? new Date(g.startTime).toISOString() : null,
    home_competitor_id: g.homeCompetitor?.id ?? g.homeCompetitorId ?? null,
    away_competitor_id: g.awayCompetitor?.id ?? g.awayCompetitorId ?? null,
    home_score: g.homeCompetitor?.score ?? g.homeScore ?? null,
    away_score: g.awayCompetitor?.score ?? g.awayScore ?? null,
    stage: g.stage ?? null,
    season_num: g.seasonNum ?? null,
    data: JSON.stringify(g),
    updated_at: new Date().toISOString(),
  }));
  await upsertMany('games', 'id', rows);
}

// ============================================================================
// Per-competition sync functions (each receives a `comp` object).
// ============================================================================

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
    log(`[comp=${comp.id}] Synced ${games.length} games`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing games:`, e.message);
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
    log(`[comp=${comp.id}] Synced ${games.length} live games`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing live games:`, e.message);
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
    log(`[comp=${comp.id}] Synced ${games.length} results`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing results:`, e.message);
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
    log(`[comp=${comp.id}] Synced ${games.length} fixtures`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing fixtures:`, e.message);
  }
}

async function syncFixtures() {
  await forEachActive(syncFixturesForComp);
}

async function syncStandingsForComp(comp) {
  log(`[comp=${comp.id}] Fetching standings...`);
  try {
    const data = await api.getStandings(comp.id, 1, comp.seasonNum);
    const rows = [{
      competition_id: comp.id,
      stage_num: 1,
      season_num: comp.seasonNum,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('standings', ['competition_id', 'stage_num', 'season_num'], rows);
    log(`[comp=${comp.id}] Synced standings`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing standings:`, e.message);
  }
}

async function syncStandings() {
  await forEachActive(syncStandingsForComp);
}

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
    log(`[comp=${comp.id}] Error syncing brackets:`, e.message);
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
    log(`[comp=${comp.id}] Error syncing tournament stats:`, e.message);
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
    log(`[comp=${comp.id}] Error syncing team of week:`, e.message);
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
    const docs = data?.docs ?? [];
    const rows = docs.map(d => ({
      competition_id: comp.id,
      season_num: d.seasonNum ?? null,
      data: JSON.stringify(d),
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await upsertMany('competition_history', ['competition_id', 'season_num'], rows);
    }
    log(`[comp=${comp.id}] Synced ${rows.length} history docs`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing competition history:`, e.message);
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
    log(`[comp=${comp.id}] Error syncing news:`, e.message);
  }
}

async function syncNews() {
  await forEachActive(syncNewsForComp);
}

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
    await pool.query('DELETE FROM trends WHERE scope = $1 AND entity_id = $2', ['competition', comp.id]);
    if (rows.length) {
      const placeholders = rows.map((_, i) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      ).join(', ');
      const values = rows.flatMap(r => [r.scope, r.entity_id, r.game_id, r.line_type_id, r.data]);
      // updated_at usa DEFAULT now() — no lo pasamos.
      await pool.query(
        `INSERT INTO trends (scope, entity_id, game_id, line_type_id, data) VALUES ${placeholders}`,
        values
      );
    }
    log(`[comp=${comp.id}] Synced ${rows.length} trends`);
  } catch (e) {
    log(`[comp=${comp.id}] Error syncing trends:`, e.message);
  }
}

async function syncTrends() {
  await forEachActive(syncTrendsForComp);
}

async function syncPredictions() {
  // No depende de competition_id: predictions viene del feed global de
  // fútbol. Lo dejamos como está.
  log('Fetching predictions...');
  try {
    const data = await api.getPredictions(1);
    const items = data?.predictions ?? [];
    const rows = items.map(p => ({
      game_id: p.gameId ?? p.id,
      data: JSON.stringify(p),
      updated_at: new Date().toISOString(),
    }));
    await upsertMany('predictions', 'game_id', rows);
    log(`Synced ${rows.length} predictions`);
  } catch (e) {
    log('Error syncing predictions:', e.message);
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
    const { rows } = await pool.query(
      'SELECT id FROM games WHERE competition_id = ANY($1::int[]) AND status_group IN (1, 2) ORDER BY start_time DESC LIMIT 30',
      [ids]
    );
    let count = 0;
    for (const { id } of rows) {
      await syncOddsForGame(id);
      count++;
    }
    log(`Synced odds for ${count} games`);
  } catch (e) {
    log('Error syncing odds:', e.message);
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
    log(`[comp=${comp.id}] Error syncing outrights:`, e.message);
  }
}

async function syncOutrights() {
  await forEachActive(syncOutrightsForComp);
}

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
    const { rows } = await pool.query(
      'SELECT id FROM games WHERE competition_id = ANY($1::int[]) AND status_group IN (1, 2, 4) ORDER BY start_time DESC LIMIT 50',
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
    log('Error syncing game details:', e.message);
  }
}

async function syncLiveStats() {
  log('Fetching live stats (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const { rows } = await pool.query(
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
    log('Error syncing live stats:', e.message);
  }
}

/**
 * syncCatalog guarda el detalle de cada comp en la tabla `competitions`
 * (catálogo upstream) y reconstruye `competitors` desde standings + top.
 */
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

    // 4. Persistir competidores (replace por active comp ids).
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
      await pool.query('DELETE FROM competitors WHERE competition_id = ANY($1::int[])', [ids]);
      await upsertMany('competitors', 'id', rows);
    }

    log(`Synced catalog (${compRows.length} competitions, ${competitorsByComp.size} competitors)`);
  } catch (e) {
    log('Error syncing catalog:', e.message);
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
    log('Error syncing countries:', e.message);
  }
}

async function syncAthletes() {
  log('Syncing athletes (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);

    const { rows } = await pool.query(
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
    const { rowCount: staleDeleted } = await pool.query(
      `DELETE FROM athletes
        WHERE id <> canonical_id
          AND canonical_id = ANY($1::bigint[])`,
      [canonicalIds]
    );
    if (staleDeleted > 0) {
      log(`Removed ${staleDeleted} stale roster-id rows before upsert`);
    }

    const rosterRows = athleteIds.map((a) => ({
      id: a.id,
      name: a.name,
      data: JSON.stringify({ ...a.rosterMember, id: a.id }),
      updated_at: new Date().toISOString(),
    }));
    await upsertMany('athletes', 'id', rosterRows);
    log(`Synced ${rosterRows.length} athlete roster rows`);

    const STALE_AFTER_MS = parseInt(process.env.ATHLETE_STALE_AFTER_MS || String(24 * 60 * 60 * 1000), 10);
    const { rows: freshRows } = await pool.query(
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
        await pool.query(
          `INSERT INTO athletes (id, name, data, updated_at)
           VALUES ($1, $2, $3::jsonb, now())
           ON CONFLICT (id) DO UPDATE
             SET name = COALESCE(EXCLUDED.name, athletes.name),
                 data = EXCLUDED.data,
                 updated_at = now()`,
          [normalized.id, normalized.name ?? null, JSON.stringify(normalized)]
        );
        hydrated++;
      } catch (e) {
        log(`  hydrate ${id} failed: ${e.message}`);
      }
    }

    log(`Hydrated ${hydrated} profiles, skipped ${skipped} (fresh or upstream-error)`);
  } catch (e) {
    log('Error syncing athletes:', e.message);
  }
}

async function syncVenues() {
  log('Syncing venues (multi-comp)...');
  try {
    const comps = await getActiveCompetitions();
    const ids = comps.map(c => c.id);
    const { rows } = await pool.query(
      'SELECT data FROM game_overviews WHERE game_id IN (SELECT id FROM games WHERE competition_id = ANY($1::int[]))',
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
    log('Error syncing venues:', e.message);
  }
}

async function syncAll() {
  log('Running full sync (multi-comp)...');
  await syncCatalog();
  await syncCountries();
  await syncGames();
  await syncLiveGames();
  await syncGamesResults();
  await syncFixtures();
  await syncStandings();
  await syncBrackets();
  await syncTournamentStats();
  await syncTeamOfWeek();
  await syncCompetitionHistory();
  await syncNews();
  await syncTrends();
  await syncPredictions();
  await syncOutrights();
  await syncOdds();
  await syncGameDetails();
  await syncLiveStats();
  await syncAthletes();
  await syncVenues();
  log('Full sync complete');
}

module.exports = {
  syncGames,
  syncLiveGames,
  syncGamesResults,
  syncFixtures,
  syncStandings,
  syncBrackets,
  syncTournamentStats,
  syncTeamOfWeek,
  syncCompetitionHistory,
  syncNews,
  syncTrends,
  syncPredictions,
  syncOdds,
  syncOutrights,
  syncGameDetails,
  syncGameDetailsForGame,
  syncGameNewsForGame,
  syncLiveStats,
  syncCatalog,
  syncCountries,
  syncAthletes,
  syncVenues,
  syncAll,
};
