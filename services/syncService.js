require('dotenv').config();
const api = require('./scores365Service');
const { pool } = require('../database/connection');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || process.env.COMPETITION_ID || '5930', 10);
const CURRENT_SEASON = parseInt(process.env.PRIMARY_SEASON || process.env.CURRENT_SEASON || '25', 10);
const START_DATE = process.env.SYNC_START_DATE || '20260601';
const END_DATE = process.env.SYNC_END_DATE || '20260815';

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

async function syncGames() {
  log('Fetching all games...');
  try {
    const data = await api.getGamesAllScores(START_DATE, END_DATE, 1, {
      onlyMajorGames: true,
      withTop: true,
      showOdds: true,
    });
    const games = (data?.games ?? []).filter(g => g.competitionId === COMPETITION_ID);
    await upsertGames(games);
    log(`Synced ${games.length} games`);
  } catch (e) {
    log('Error syncing games:', e.message);
  }
}

async function syncLiveGames() {
  log('Fetching live games...');
  try {
    const data = await api.getGamesCurrent(COMPETITION_ID);
    const games = data?.games ?? [];
    await upsertGames(games);
    log(`Synced ${games.length} live games`);
  } catch (e) {
    log('Error syncing live games:', e.message);
  }
}

async function syncGamesResults() {
  log('Fetching results...');
  try {
    const data = await api.getGamesResults(COMPETITION_ID);
    const games = data?.games ?? [];
    await upsertGames(games);
    log(`Synced ${games.length} results`);
  } catch (e) {
    log('Error syncing results:', e.message);
  }
}

async function syncFixtures() {
  log('Fetching fixtures...');
  try {
    const data = await api.getFixtures(COMPETITION_ID);
    const games = data?.games ?? [];
    await upsertGames(games);
    log(`Synced ${games.length} fixtures`);
  } catch (e) {
    log('Error syncing fixtures:', e.message);
  }
}

async function syncStandings() {
  log('Fetching standings...');
  try {
    const data = await api.getStandings(COMPETITION_ID, 1, CURRENT_SEASON);
    const rows = [{
      competition_id: COMPETITION_ID,
      stage_num: 1,
      season_num: CURRENT_SEASON,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('standings', ['competition_id', 'stage_num', 'season_num'], rows);
    log('Synced standings');
  } catch (e) {
    log('Error syncing standings:', e.message);
  }
}

async function syncBrackets() {
  log('Fetching brackets...');
  try {
    const data = await api.getBrackets(COMPETITION_ID);
    const rows = [{
      competition_id: COMPETITION_ID,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('brackets', 'competition_id', rows);
    log('Synced brackets');
  } catch (e) {
    log('Error syncing brackets:', e.message);
  }
}

async function syncTournamentStats() {
  log('Fetching tournament stats...');
  try {
    const data = await api.getTournamentStats(COMPETITION_ID, CURRENT_SEASON);
    const rows = [{
      competition_id: COMPETITION_ID,
      season_num: CURRENT_SEASON,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('tournament_stats', ['competition_id', 'season_num'], rows);
    log('Synced tournament stats');
  } catch (e) {
    log('Error syncing tournament stats:', e.message);
  }
}

async function syncTeamOfWeek() {
  log('Fetching team of week...');
  try {
    const data = await api.getTeamOfWeek(COMPETITION_ID);
    const rows = [{
      competition_id: COMPETITION_ID,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('team_of_week', 'competition_id', rows);
    log('Synced team of week');
  } catch (e) {
    log('Error syncing team of week:', e.message);
  }
}

async function syncCompetitionHistory() {
  log('Fetching competition history...');
  try {
    const data = await api.getCompetitionHistory(COMPETITION_ID);
    const docs = data?.docs ?? [];
    const rows = docs.map(d => ({
      competition_id: COMPETITION_ID,
      season_num: d.seasonNum ?? null,
      data: JSON.stringify(d),
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await upsertMany('competition_history', ['competition_id', 'season_num'], rows);
    }
    log(`Synced ${rows.length} history docs`);
  } catch (e) {
    log('Error syncing competition history:', e.message);
  }
}

async function syncNews() {
  log('Fetching news...');
  try {
    const data = await api.getNews('competition', COMPETITION_ID);
    const items = data?.news ?? [];
    const rows = items.map(n => ({
      id: n.id,
      scope: 'competition',
      entity_id: COMPETITION_ID,
      game_id: n.gameId ?? null,
      publish_date: n.publishDate ? new Date(n.publishDate).toISOString() : null,
      data: JSON.stringify(n),
      updated_at: new Date().toISOString(),
    }));
    await upsertMany('news', 'id', rows);
    log(`Synced ${rows.length} news items`);
  } catch (e) {
    log('Error syncing news:', e.message);
  }
}

async function syncTrends() {
  log('Fetching trends...');
  try {
    const data = await api.getTrends('competition', COMPETITION_ID);
    const items = data?.trends ?? [];
    const rows = items.map(t => ({
      scope: 'competition',
      entity_id: COMPETITION_ID,
      game_id: t.gameId ?? t.homeTeamGameId ?? null,
      line_type_id: t.lineTypeId ?? null,
      data: JSON.stringify(t),
      updated_at: new Date().toISOString(),
    }));
    await pool.query('DELETE FROM trends WHERE scope = $1 AND entity_id = $2', ['competition', COMPETITION_ID]);
    if (rows.length) {
      const placeholders = rows.map((_, i) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      ).join(', ');
      const values = rows.flatMap(r => [r.scope, r.entity_id, r.game_id, r.line_type_id, r.data]);
      await pool.query(
        `INSERT INTO trends (scope, entity_id, game_id, line_type_id, data, updated_at) VALUES ${placeholders}`,
        values
      );
    }
    log(`Synced ${rows.length} trends`);
  } catch (e) {
    log('Error syncing trends:', e.message);
  }
}

async function syncPredictions() {
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

async function syncOdds() {
  log('Fetching odds for active games...');
  try {
    const { rows } = await pool.query(
      'SELECT id FROM games WHERE competition_id = $1 AND status_group IN (1, 2) ORDER BY start_time DESC LIMIT 20',
      [COMPETITION_ID]
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

async function syncOutrights() {
  log('Fetching outrights...');
  try {
    const data = await api.getOutrights(COMPETITION_ID);
    const rows = [{
      competition_id: COMPETITION_ID,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }];
    await upsertMany('odds_outrights', 'competition_id', rows);
    log('Synced outrights');
  } catch (e) {
    log('Error syncing outrights:', e.message);
  }
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
    // Alineaciones enriquecidas (endpoint dedicado con names, athleteIds, stats).
    if (lineups.status === 'fulfilled' && lineups.value) {
      const rows = [{
        game_id: gameId,
        data: JSON.stringify(lineups.value),
        updated_at: new Date().toISOString(),
      }];
      await upsertMany('game_lineups', 'game_id', rows);
    }
    // Stats completas del partido (no solo live).
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
  log('Fetching game details...');
  try {
    const { rows } = await pool.query(
      'SELECT id FROM games WHERE competition_id = $1 AND status_group IN (1, 2, 4) ORDER BY start_time DESC LIMIT 50',
      [COMPETITION_ID]
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
  log('Fetching live stats...');
  try {
    const { rows } = await pool.query(
      'SELECT id FROM games WHERE competition_id = $1 AND status_group = 1',
      [COMPETITION_ID]
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

async function syncCatalog() {
  log('Syncing catalog...');
  try {
    const [compData, topData, standingsData] = await Promise.allSettled([
      api.getCompetition(COMPETITION_ID),
      api.getTopCompetitors(300),
      api.getStandings(COMPETITION_ID, 1, CURRENT_SEASON),
    ]);

    if (compData.status === 'fulfilled') {
      const comps = compData.value?.competitions || [];
      const comp = comps[0];
      if (comp) {
        const rows = [{
          id: comp.id,
          data: JSON.stringify(compData.value),
          updated_at: new Date().toISOString(),
        }];
        await upsertMany('competitions', 'id', rows);
      }
    }

    // Source of truth for the Mundial competitors: the standings endpoint.
    // Each row.competitor has mainCompetitionId matching COMPETITION_ID.
    const competitorsByComp = new Map();
    if (standingsData.status === 'fulfilled') {
      const stages = standingsData.value?.standings ?? [];
      for (const stage of stages) {
        for (const row of stage.rows ?? []) {
          const c = row.competitor;
          if (!c || !c.id) continue;
          const cid = c.mainCompetitionId ?? c.competitionId ?? null;
          competitorsByComp.set(c.id, { competitor: c, competitionId: cid });
        }
      }
      // Ensure Mundial competitors are tagged with COMPETITION_ID even if the
      // API returns a different mainCompetitionId for some rows.
      for (const [, v] of competitorsByComp) {
        if (v.competitor.id && (v.competitor.mainCompetitionId ?? null) === null) {
          v.competitionId = COMPETITION_ID;
        }
      }
    }

    // Merge in any extra teams from getTopCompetitors (clubs, leagues) that
    // aren't already tracked.
    if (topData.status === 'fulfilled') {
      for (const c of topData.value?.competitors ?? []) {
        if (!competitorsByComp.has(c.id)) {
          competitorsByComp.set(c.id, { competitor: c, competitionId: c.competitionId ?? null });
        }
      }
    }

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
      await pool.query('DELETE FROM competitors WHERE competition_id = $1', [COMPETITION_ID]);
      await upsertMany('competitors', 'id', rows);
    }

    log('Synced catalog');
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
  log('Syncing athletes...');
  try {
    // Read members from game_lineups (populated by syncGameDetails) instead
    // of game_overviews. game_lineups members expose the canonical
    // upstream athleteId plus name/imageVersion/position, which are not
    // reliably present in the overview cache.
    const { rows } = await pool.query(
      `SELECT gl.data AS lineups
         FROM game_lineups gl
         JOIN games g ON g.id = gl.game_id
        WHERE g.competition_id = $1`,
      [COMPETITION_ID]
    );

    // 1. Discover canonical athlete ids from roster members.
    //    Upstream members expose both a roster/member record id (`m.id`) and
    //    the canonical upstream player id (`m.athleteId`). Tournament stats
    //    and the dashboard /player/:id route use the canonical one.
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

    // 2a. Clean stale roster-id rows for these canonical ids. If a previous
    //     sync (or the pre-007 Cosmos-era bootstrap) left a row at id=roster
    //     while canonical_id was set, the unique index idx_athletes_canonical_id
    //     would block inserting/updating the row at id=canonical.
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

    // 2b. Insert lightweight rows immediately so /player/:id hits don't 404
    //     while we hydrate. data.id is the canonical id (re-keyed via 007).
    const rosterRows = athleteIds.map((a) => ({
      id: a.id,
      name: a.name,
      data: JSON.stringify({ ...a.rosterMember, id: a.id }),
      updated_at: new Date().toISOString(),
    }));
    await upsertMany('athletes', 'id', rosterRows);
    log(`Synced ${rosterRows.length} athlete roster rows`);

    // 3. Hydrate full profiles from 365scores. Skip ids that already have a
    //    fresh cached profile to avoid hammering the upstream and to keep
    //    the job within reasonable runtime.
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
  log('Syncing venues...');
  try {
    const { rows } = await pool.query(
      'SELECT data FROM game_overviews WHERE game_id IN (SELECT id FROM games WHERE competition_id = $1)',
      [COMPETITION_ID]
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
  log('Running full sync...');
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
