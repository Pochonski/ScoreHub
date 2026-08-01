const db = require('../../../database/db');
const scores365 = require('../../../services/scores365Service');
const images = require('../../../services/images');

/**
 * Helper: lee de una tabla por competitor_id; si está stale (>TTL),
 * hidrata desde upstream y persiste. Retorna { data, source }.
 */
async function readOrHydrate(table, competitorId, fetcher, { ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  const { data: row, error } = await db.query(table, {
    select: 'data, updated_at',
    eq: { competitor_id: competitorId },
    maybeSingle: true,
  });
  if (error) throw error;
  if (row?.data) {
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (age < ttlMs) return { data: row.data, source: 'db' };
  }
  try {
    const fresh = await fetcher();
    if (fresh) {
      await db.upsert(table, [{ competitor_id: competitorId, data: JSON.stringify(fresh) }], 'competitor_id');
    }
    return { data: fresh, source: '365+hydrate' };
  } catch (upstreamErr) {
    // Fallback a data stale si está, si no vacío.
    return { data: row?.data ?? null, source: '365-error' };
  }
}

/**
 * GET /teams/:id/info
 * Detalle del equipo. INVERTIDO en Fase 8.3: DB primero, fallback a 365.
 * (Antes era 365_PRIMARY).
 */
async function getTeamInfo(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    // 1. Intentar DB (competitors table cacheada por syncCatalog)
    const { data: row, error } = await db.query('competitors', {
      select: 'id, name, data',
      eq: { id },
      maybeSingle: true,
    });
    if (error) throw error;
    if (row?.data) {
      const t = row.data;
      return res.json({
        id: Number(row.id),
        name: row.name,
        shortName: t.shortName,
        symbolicName: t.symbolicName,
        nameForURL: t.nameForURL,
        countryId: t.countryId,
        sportId: t.sportId,
        type: t.type,
        popularityRank: t.popularityRank,
        imageVersion: t.imageVersion ?? 1,
        color: t.color,
        awayColor: t.awayColor,
        mainCompetitionId: t.mainCompetitionId,
        hasSquad: t.hasSquad,
        hasTransfers: t.hasTransfers,
        badgeUrl: images.getTeamBadgeUrl(row.id, t.imageVersion ?? 1),
        seasons: t.seasons ?? [],
      });
    }

    // 2. Cache miss: hydrate desde 365
    try {
      const data = await scores365.getCompetitor(id, { withSeasons: true });
      const list = data?.competitors ?? [];
      const c = list[0] || data?.competitor;
      if (!c) return res.status(404).json({ error: 'Equipo no encontrado' });
      return res.json({
        id: Number(c.id),
        name: c.name,
        shortName: c.shortName,
        symbolicName: c.symbolicName,
        nameForURL: c.nameForURL,
        countryId: c.countryId,
        sportId: c.sportId,
        type: c.type,
        popularityRank: c.popularityRank,
        imageVersion: c.imageVersion ?? 1,
        color: c.color,
        awayColor: c.awayColor,
        mainCompetitionId: c.mainCompetitionId,
        hasSquad: c.hasSquad,
        hasTransfers: c.hasTransfers,
        badgeUrl: images.getTeamBadgeUrl(c.id, c.imageVersion ?? 1),
        seasons: c.seasons ?? [],
      });
    } catch (_) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /teams/:id/recent-form
 * DB_ONLY vía team_recent_form (hydrate-on-demand).
 */
async function getTeamRecentForm(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const numOfGames = Math.min(20, Math.max(1, parseInt(req.query.numOfGames, 10) || 5));

    const { data } = await readOrHydrate(
      'team_recent_form',
      id,
      () => scores365.getCompetitorRecentForm(id, numOfGames).then(d => d?.games ?? null),
    );
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /teams/:id/upcoming
 * DB_ONLY vía team_upcoming (hydrate-on-demand).
 */
async function getTeamUpcoming(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    const { data } = await readOrHydrate(
      'team_upcoming',
      id,
      () => scores365.getFixtures(id).then(d => d?.games ?? null),
    );
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /teams/:id/recent-matches
 * DB_ONLY vía team_recent_results (hydrate-on-demand).
 */
async function getTeamRecentMatches(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    const { data } = await readOrHydrate(
      'team_recent_results',
      id,
      async () => {
        const d = await scores365.getGamesCurrent(id);
        return (d?.games ?? []).filter(g => g.statusGroup === 4);
      },
    );
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTeamInfo,
  getTeamRecentForm,
  getTeamUpcoming,
  getTeamRecentMatches,
};