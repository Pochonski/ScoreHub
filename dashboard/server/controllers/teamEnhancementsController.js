const db = require('../../../database/db');
const scores365 = require('../../../services/scores365Service');
const images = require('../../../services/images');

/**
 * GET /teams/:id/info
 * Detalle completo de un equipo desde upstream (no cacheado). Usado en
 * /equipo/:id para mostrar info rica (color, popularityRank, mainCompetitionId).
 */
async function getTeamInfo(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    try {
      const data = await scores365.getCompetitor(id, { withSeasons: true });
      const list = data?.competitors ?? [];
      const c = list[0] || data?.competitor;
      if (c) {
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
      }
    } catch (_) {
      // upstream failed, fall through to DB fallback
    }

    // Fallback: competitors table.
    const { data: row, error } = await db.query('competitors', {
      select: 'id, name, data',
      eq: { id },
      maybeSingle: true,
    });
    if (error) throw error;
    if (!row) return res.status(404).json({ error: 'Equipo no encontrado' });
    const t = row.data || {};
    res.json({
      id: Number(row.id),
      name: row.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion ?? 1,
      mainCompetitionId: t.mainCompetitionId,
      badgeUrl: images.getTeamBadgeUrl(row.id, t.imageVersion ?? 1),
    });
  } catch (err) {
    next(err);
  }
}

async function getTeamRecentForm(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const numOfGames = Math.min(20, Math.max(1, parseInt(req.query.numOfGames, 10) || 5));

    const data = await scores365.getCompetitorRecentForm(id, numOfGames);
    const games = data?.games ?? [];
    res.json(games);
  } catch (err) {
    next(err);
  }
}

async function getTeamUpcoming(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    const data = await scores365.getFixtures(id);
    const games = data?.games ?? [];
    res.json(games);
  } catch (err) {
    next(err);
  }
}

async function getTeamRecentMatches(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    const data = await scores365.getGamesCurrent(id);
    const games = (data?.games ?? []).filter(g => g.statusGroup === 4);
    res.json(games);
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
