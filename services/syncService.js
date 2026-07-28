require('dotenv').config();
const api = require('./scores365Service');
const { pool, withTransaction } = require('../database/connection');
const db = require('../database/db');
const { getActiveCompetitions, forEachActive } = require('./syncCompetitions');
const logger = require('../utils/logger');

// Logger por defecto para este módulo. Cada vez que se ejecuta un sync
// completo se crea un child con su propio `syncRunId` para correlacionar
// los logs.
let currentSyncRunId = null;

function newSyncRunId() {
  // Pequeño identificador (timestamp + random) suficiente para correlación
  // manual en Vercel logs. NO es un correlador único criptográfico.
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${t}-${r}`;
}

function log(...args) {
  // pino expects (mergeObject, msg). Flatten rest args into a single message.
  logger.info({ syncRunId: currentSyncRunId, mod: 'sync' }, '[Sync] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
}

function logErr(...args) {
  logger.error({ syncRunId: currentSyncRunId, mod: 'sync' }, '[Sync] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
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

// ============================================================================
// Specialized upsert helpers — prevent partial JSONB from overwriting
// the canonical, complete document stored in `competitors.data` or
// `athletes.data`.
// ============================================================================

/**
 * Upsert a canonical competitor document (full name, imageVersion,
 * countryId, etc). Only used by `syncCatalog` so catalog writes
 * fully replace what the previous sync wrote.
 */
async function upsertCompetitorCanonical(client, row) {
  await client.query(
    `INSERT INTO competitors (id, competition_id, name, data, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (id) DO UPDATE
       SET competition_id = COALESCE(EXCLUDED.competition_id, competitors.competition_id),
           name = EXCLUDED.name,
           data = EXCLUDED.data,
           updated_at = EXCLUDED.updated_at`,
    [
      row.id,
      row.competition_id ?? null,
      row.name ?? null,
      row.data,
      row.updated_at || new Date().toISOString(),
    ]
  );
}

/**
 * Upsert a `reference` to a competitor (e.g. from transfers or lineups).
 * Touches only `name`/`updated_at` — does NOT overwrite `data` or
 * `competition_id`, so the canonical row from `syncCatalog` is preserved.
 *
 * If the competitor does not yet exist, creates a minimal row with just
 * the id and a `{id}` placeholder in `data`. Subsequent canonical sync
 * will fill in the rest.
 */
async function upsertCompetitorReference(client, id, name = null) {
  await client.query(
    `INSERT INTO competitors (id, name, data, updated_at)
     VALUES ($1, $2, jsonb_build_object('id', $1::int), $3)
     ON CONFLICT (id) DO UPDATE
       SET name = COALESCE(NULLIF(EXCLUDED.name, ''), competitors.name),
           updated_at = EXCLUDED.updated_at`,
    [Number(id), name || null, new Date().toISOString()]
  );
}

/**
 * Upsert a canonical athlete profile (full careerStats, trophies,
 * transfers, etc). Marks source='profile' so future roster/transfer
 * syncs cannot override it.
 */
async function upsertAthleteCanonical(client, row) {
  await client.query(
    `INSERT INTO athletes (id, name, data, source, updated_at)
     VALUES ($1, $2, $3::jsonb, 'profile', $4)
     ON CONFLICT (id) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, athletes.name),
           data = EXCLUDED.data,
           source = 'profile',
           updated_at = EXCLUDED.updated_at`,
    [
      row.id,
      row.name ?? null,
      row.data,
      row.updated_at || new Date().toISOString(),
    ]
  );
}

/**
 * Roster-membership upsert for athletes: touches only minimal columns and
 * DOES NOT overwrite `data` if a canonical profile already exists. Marks
 * source='roster' for traceability.
 */
async function upsertRosterMembership(client, id, name) {
  await client.query(
    `INSERT INTO athletes (id, name, data, source, updated_at)
     VALUES ($1, $2, jsonb_build_object('id', $1::bigint, 'rosterInserted', true), 'roster', $3)
     ON CONFLICT (id) DO UPDATE
       SET name = COALESCE(NULLIF(EXCLUDED.name, ''), athletes.name),
           -- Only update data when the existing row is NOT a full profile
           data = CASE WHEN athletes.source = 'profile'
                       THEN athletes.data
                       ELSE EXCLUDED.data
                  END,
           source = CASE WHEN athletes.source = 'profile'
                         THEN 'profile'
                         ELSE 'roster'
                    END,
           updated_at = EXCLUDED.updated_at`,
    [Number(id), name || null, new Date().toISOString()]
  );
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

/**
 * Mantiene la tabla junction `competition_competitors` derivada de un set
 * de standings responses (un upsert por season).
 */
async function upsertCompetitionCompetitorsFromStandings(competitionId, seasonNum, stages) {
  if (!Number.isFinite(competitionId) || !Number.isFinite(seasonNum)) return;
  const seen = new Set();
  const compId = competitionId;
  const season = seasonNum;
  const now = new Date().toISOString();
  const compIds = [];
  const competitorIds = [];
  const seasonNums = [];
  const sources = [];

  for (const stage of stages) {
    const stageNum = Number(stage.num ?? stage.stageNum);
    const rows = stage.rows || [];
    for (const row of rows) {
      const cid = Number(row.competitor?.id);
      if (!Number.isFinite(cid)) continue;
      const key = `${compId}-${cid}-${season}`;
      if (seen.has(key)) continue;
      seen.add(key);
      compIds.push(compId);
      competitorIds.push(cid);
      seasonNums.push(season);
      sources.push('standings');
    }
    if (!Number.isFinite(stageNum)) continue;
  }
  if (compIds.length === 0) return;
  await pool.query(
    `INSERT INTO competition_competitors
       (competition_id, competitor_id, season_num, source, last_seen_at)
     SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::text[], $5::timestamptz[])
     ON CONFLICT (competition_id, competitor_id, season_num) DO UPDATE
       SET last_seen_at = EXCLUDED.last_seen_at`,
    [
      compIds,
      competitorIds,
      seasonNums,
      sources,
      competitorIds.map(() => now),
    ]
  );
}
async function upsertCompetitionCompetitorsFromGames(games) {
  if (!games?.length) return;
  // Dedupe by (competition, competitor, season) keeping one row.
  const seen = new Set();
  const rows = [];
  const now = new Date().toISOString();
  for (const g of games) {
    const compId = Number(g.competitionId);
    const season = Number(g.seasonNum);
    if (!Number.isFinite(compId) || !Number.isFinite(season)) continue;
    const homeId = g.homeCompetitor?.id ?? g.homeCompetitorId;
    const awayId = g.awayCompetitor?.id ?? g.awayCompetitorId;
    const stage = Number(g.stage ?? null);
    const group = Number(g.groupNum ?? null);

    if (Number.isFinite(homeId)) {
      const key = `${compId}-${homeId}-${season}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({
          competition_id: compId,
          competitor_id: homeId,
          season_num: season,
          stage_num: Number.isFinite(stage) ? stage : null,
          group_id: Number.isFinite(group) ? group : null,
          source: 'games',
          joined_at: now,
          last_seen_at: now,
        });
      }
    }
    if (Number.isFinite(awayId)) {
      const key = `${compId}-${awayId}-${season}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({
          competition_id: compId,
          competitor_id: awayId,
          season_num: season,
          stage_num: Number.isFinite(stage) ? stage : null,
          group_id: Number.isFinite(group) ? group : null,
          source: 'games',
          joined_at: now,
          last_seen_at: now,
        });
      }
    }
  }
  if (!rows.length) return;
  // Upsert into competition_competitors. Use Postgres-specific ON CONFLICT.
  await pool.query(
    `INSERT INTO competition_competitors
       (competition_id, competitor_id, season_num, stage_num, group_id, source, joined_at, last_seen_at)
     SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[], $5::int[], $6::text[], $7::timestamptz[], $8::timestamptz[])
     ON CONFLICT (competition_id, competitor_id, season_num) DO UPDATE
       SET last_seen_at = EXCLUDED.last_seen_at,
           stage_num = COALESCE(EXCLUDED.stage_num, competition_competitors.stage_num),
           group_id = COALESCE(EXCLUDED.group_id, competition_competitors.group_id)`,
    [
      rows.map(r => r.competition_id),
      rows.map(r => r.competitor_id),
      rows.map(r => r.season_num),
      rows.map(r => r.stage_num),
      rows.map(r => r.group_id),
      rows.map(r => r.source),
      rows.map(r => r.joined_at),
      rows.map(r => r.last_seen_at),
    ]
  );
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
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} games`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing games: ${e.message}`);
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
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} live games`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing live games: ${e.message}`);
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
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} results`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing results: ${e.message}`);
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
    if (games.length) await upsertCompetitionCompetitorsFromGames(games);
    log(`[comp=${comp.id}] Synced ${games.length} fixtures`);
  } catch (e) {
    logErr(`[comp=${comp.id}] Error syncing fixtures: ${e.message}`);
  }
}

async function syncFixtures() {
  await forEachActive(syncFixturesForComp);
}

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

    const STALE_AFTER_MS = parseInt(process.env.ATHLETE_STALE_AFTER_MS || String(24 * 60 * 60 * 1000), 10);
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

async function syncAll() {
  currentSyncRunId = newSyncRunId();
  log('Running full sync (multi-comp)...');
  try {
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
    await syncTransfers();
    await syncSuggestions();
    log('Full sync complete');
  } finally {
    currentSyncRunId = null;
  }
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
  syncTransfers,
  syncTransfersForComp,
  syncSuggestions,
  syncSuggestionsForComp,
  syncAll,
};
