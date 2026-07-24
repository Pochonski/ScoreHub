const { pool, withTransaction } = require('../../../database/connection');
const db = require('../../../database/db');
const { enrichAthlete, enrichTransferWithTeam } = require('../utils/mappers');

// Lazy-load the upstream service so we don't pay for it on cold starts when
// cache hits dominate. Loading is cheap (top-level only fetches dotenv).
const api = require('../../../services/scores365Service');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

// Cache-on-read settings. Lazy hydration is bounded to keep the Vercel
// function under its 30s max duration.
const HYDRATE_TIMEOUT_MS = parseInt(process.env.ATHLETE_HYDRATE_TIMEOUT_MS || '8000', 10);
const STALE_AFTER_MS = parseInt(process.env.ATHLETE_STALE_AFTER_MS || String(24 * 60 * 60 * 1000), 10);

// In-flight de-duplication to prevent stampede when many concurrent
// requests hit the same uncached athlete id (e.g. /player/39820 right after
// a backfill). Map<id, Promise<row|null>>.
const inflightHydrations = new Map();

function isRowSparse(row) {
  if (!row) return true;
  const d = row.data || {};
  return !(d.trophies && d.trophies.categories) && !(d.transfers && d.transfers.length) && !(d.careerStats && d.careerStats.seasons);
}

function isRowStale(row) {
  if (!row?.updated_at) return true;
  const ts = new Date(row.updated_at).getTime();
  return Date.now() - ts > STALE_AFTER_MS;
}

/**
 * Normalize cached data so downstream mappers see the canonical id.
 *
 * After the Cosmos→Supabase migration the PK was re-keyed to canonical but
 * `data.id` still holds the old roster-member id. We coerce it here so
 * enrichAthlete builds photo URLs from the canonical id without requiring
 * a second pass over every existing row.
 */
function normalizeData(data, canonicalId) {
  if (!data) return data;
  return { ...data, id: canonicalId };
}

async function fetchRowById(id) {
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  // Lookup by PK first, then by canonical_id (handles legacy rows where
  // canonical was stored only inside data->>'athleteId').
  const rows = await db.execAdvanced(
    `SELECT id, name, data, updated_at, canonical_id
       FROM athletes
      WHERE id = $1
         OR (canonical_id IS NOT NULL AND canonical_id = $1)
      ORDER BY (id = $1) DESC
      LIMIT 1`,
    [num]
  );
  return rows[0] || null;
}

/**
 * Fetch the full profile from 365scores and persist it. Bounded by
 * HYDRATE_TIMEOUT_MS (outer deadline). Throws on failure so the caller can
 * decide whether to fall back to the (partial) cached row.
 *
 * The scores365 service internally retries 5xx/429 and has its own per-attempt
 * timeout; here we only impose the outer deadline via AbortController.signal.
 */
async function hydrateFromUpstream(id) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HYDRATE_TIMEOUT_MS);
  try {
    const res = await api.getAthlete(id, true, { signal: ac.signal });
    const a = res?.athletes?.[0];
    if (!a || !a.id) throw new Error('athlete not found upstream');

    const normalized = {
      ...a,
      id: Number(a.id),
      // Ensure data.id matches the canonical PK so enrichAthlete's photo URL
      // helper uses the right id even before backfill is rerun.
      name: a.name ?? null,
    };

    await db.execAdvanced(
      `INSERT INTO athletes (id, name, data, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (id) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, athletes.name),
             data = EXCLUDED.data,
             updated_at = now()`,
      [normalized.id, normalized.name, JSON.stringify(normalized)]
    );
    return normalized;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve an athlete id to a usable object.
 *
 * Order of operations:
 *   1. Cache hit (fresh)        → return cached row.
 *   2. Cache hit (stale/sparse) → trigger background hydrate, return cached.
 *   3. Cache miss              → hydrate inline, upsert, return.
 *   4. Upstream failure        → return cached row if any, else 404.
 *
 * Multiple concurrent requests for the same id share one in-flight promise.
 */
async function loadAthlete(id) {
  const cached = await fetchRowById(id);

  if (cached && !isRowStale(cached) && !isRowSparse(cached)) {
    return { athlete: normalizeData(cached.data, Number(cached.id) || cached.canonical_id), hydrated: false };
  }

  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return { athlete: cached ? normalizeData(cached.data, Number(cached.id)) : null, hydrated: false };
  }

  // If a hydration is already running for this id, await it.
  let pending = inflightHydrations.get(numId);

  if (!pending) {
    pending = (async () => {
      try {
        return await hydrateFromUpstream(numId);
      } finally {
        // Always clear, even on error, so future requests can retry.
        inflightHydrations.delete(numId);
      }
    })();
    inflightHydrations.set(numId, pending);
  }

  try {
    const fresh = await pending;
    return { athlete: fresh, hydrated: true };
  } catch (err) {
    // Upstream failed: fall back to whatever we have, even if stale.
    if (cached) return { athlete: normalizeData(cached.data, Number(cached.id)), hydrated: false };
    return { athlete: null, hydrated: false, error: err };
  }
}

async function getCompetitorMap() {
  const { data: rows, error } = await db.query('competitors', {
    select: 'id, name, data',
    limit: 2000,
  });
  if (error) throw error;
  const map = {};
  for (const r of rows || []) {
    map[String(r.id)] = { name: r.name || r.data?.name, imageVersion: r.data?.imageVersion };
  }
  return map;
}

/**
 * Map a raw upstream trophy document to the public contract.
 *
 * Upstream shape (legacy and current):
 *   { categories: { "<categoryName>": { name, trophies: [{name, count, competitionId}] } } }
 *
 * Returns: [{ name, trophies: [{ name, count, competitionId }] }]
 */
function shapeTrophies(raw) {
  const doc = raw || {};
  const categories = doc.categories || doc;
  if (!categories || typeof categories !== 'object') return [];
  return Object.values(categories).map((cat) => ({
    name: cat.name,
    trophies: (cat.trophies || []).map((t) => ({
      name: t.name,
      count: t.count,
      competitionId: t.competitionId,
    })),
  }));
}

/**
 * Map a raw upstream career document to the public contract.
 *
 * Upstream shape (current):
 *   { careerStats: { seasons: [{ key, name, stats }] } }
 *
 * Legacy shape (kept for backwards compatibility):
 *   { careers: [{ seasonKey, name, stats }] }
 */
function shapeCareer(raw) {
  if (!raw) return [];
  const seasons = raw.careerStats?.seasons ?? raw.careers ?? [];
  if (!Array.isArray(seasons)) return [];
  return seasons.map((s) => ({
    seasonKey: s.key ?? s.seasonKey,
    name: s.name,
    stats: s.stats,
  }));
}

async function searchAthletes(req, res, next) {
  try {
    const { search, teamId } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const offset = (page - 1) * limit;

    const params = [];
    const conds = [];

    if (search && String(search).trim()) {
      params.push(`%${String(search).toLowerCase()}%`);
      conds.push(`lower(name) LIKE $${params.length}`);
    }

    const tid = teamId ? Number(teamId) : null;
    if (Number.isFinite(tid)) {
      params.push(tid);
      conds.push(`(data->>'competitorId')::bigint = $${params.length}`);
    }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(limit, offset);

    const rows = await db.execAdvanced(
      `SELECT id, name, data
         FROM athletes
         ${whereSql}
         ORDER BY name ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json(rows.map(r => enrichAthlete({ ...r.data, id: r.id, name: r.name })));
  } catch (err) {
    next(err);
  }
}

async function getAthleteById(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      return res.status(400).json({ error: 'id inválido' });
    }
    const { athlete } = await loadAthlete(numId);
    if (!athlete) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(enrichAthlete(athlete));
  } catch (err) {
    next(err);
  }
}

async function getAthleteCareer(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return res.json([]);
    const { athlete } = await loadAthlete(numId);
    if (!athlete) return res.json([]);
    res.json(shapeCareer(athlete));
  } catch (err) {
    next(err);
  }
}

async function getAthleteTrophies(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return res.json([]);
    const { athlete } = await loadAthlete(numId);
    if (!athlete) return res.json([]);
    res.json(shapeTrophies(athlete.trophies || athlete.honours));
  } catch (err) {
    next(err);
  }
}

async function getAthleteTransfers(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return res.json([]);
    const { athlete } = await loadAthlete(numId);
    if (!athlete) return res.json([]);
    const rawTransfers = athlete.transfers || [];
    if (!rawTransfers.length) return res.json([]);
    const map = await getCompetitorMap();
    const transfers = rawTransfers.map((t) => enrichTransferWithTeam({
      date: t.date,
      competitorId: t.competitorId,
      transferTitle: t.transferTitle,
      contractUntil: t.contractUntil,
    }, map));
    res.json(transfers);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchAthletes,
  getAthleteById,
  getAthleteCareer,
  getAthleteTrophies,
  getAthleteTransfers,
  // exposed for tests
  _internal: { shapeCareer, shapeTrophies, isRowSparse, isRowStale, hydrateFromUpstream, loadAthlete },
};