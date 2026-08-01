/**
 * src/infrastructure/persistence/syncWriters.js — Escritores del sync (Fase 7, Fase 4).
 *
 * Helpers de upsert/persistencia usados por los jobs ETL de application/sync.
 * Extraídos verbatim desde syncService.js. Incluyen los upserts especializados
 * que preservan el documento JSONB canónico (competitors/athletes) frente a
 * payloads parciales de roster/transfer, y las tablas junction.
 *
 * Los que reciben `client` corren dentro de una transacción (withTransaction);
 * el resto usa el `pool` directo.
 */

const { pool, pgQueryRetry } = require('../../../database/connection');

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
  await pgQueryRetry(query, values);
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
  await pgQueryRetry(
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
  await pgQueryRetry(
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

module.exports = {
  upsertMany,
  upsertCompetitorCanonical,
  upsertCompetitorReference,
  upsertAthleteCanonical,
  upsertRosterMembership,
  upsertGames,
  upsertCompetitionCompetitorsFromStandings,
  upsertCompetitionCompetitorsFromGames,
};
