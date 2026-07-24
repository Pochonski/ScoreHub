const db = require('../../../database/db');
const images = require('../../../services/images');
const { enrichGame } = require('../utils/mappers');
const { resolveCompetition } = require('../utils/competition');

async function getTeams(req, res, next) {
  try {
    const nationalOnly = req.query.national === 'true';
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    // NOTE: this filters by competitors.competition_id which Phase 3 plan
    // says is fragile (sync can overwrite). Kept as-is until migration
    // 018 (competition_competitors table) lands.
    const { data: rows, error } = await db.query('competitors', {
      select: 'id, name, data',
      eq: { competition_id: competitionId },
      limit: 2000,
    });
    if (error) throw error;
    let mapped = (rows || []).map(r => {
      const t = r.data;
      return {
        id: r.id,
        name: r.name,
        shortName: t.shortName,
        symbolicName: t.symbolicName,
        countryId: t.countryId,
        imageVersion: t.imageVersion,
        badgeUrl: r.id ? images.getTeamBadgeUrl(r.id, t.imageVersion || 1) : null,
        flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
        isNational: t.isNational ?? null,
        type: t.type ?? null,
      };
    });
    if (nationalOnly) {
      mapped = mapped.filter(t => t.isNational === true || t.type === 2);
    }
    mapped.sort((a, b) => a.name.localeCompare(b.name));
    res.json(mapped);
  } catch (err) {
    next(err);
  }
}

async function getTeamById(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await db.query('competitors', {
      select: 'id, data',
      eq: { id: Number(id) },
      maybeSingle: true,
    });
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Equipo no encontrado' });
    const t = data.data;
    res.json({
      id: data.id,
      name: t.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion,
      badgeUrl: images.getTeamBadgeUrl(data.id, t.imageVersion || 1),
      flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
    });
  } catch (err) {
    next(err);
  }
}

async function getTeamMatches(req, res, next) {
  try {
    const { id } = req.params;
    const tid = Number(id);
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    const { data: rows, error } = await db.query('games', {
      select: 'data',
      or: `(home_competitor_id.eq.${tid},away_competitor_id.eq.${tid})`,
      eq: { competition_id: competitionId },
      order: { column: 'start_time', asc: false },
      limit: 200,
    });
    if (error) {
      // PostgREST or syntax may not be supported in pg fallback; retry via execAdvanced.
      const fallback = await db.execAdvanced(
        `SELECT data FROM games
          WHERE competition_id = $1
            AND (home_competitor_id = $2 OR away_competitor_id = $2)
          ORDER BY start_time DESC`,
        [competitionId, tid]
      );
      const games = fallback.map(r => enrichGame(r.data));
      return res.json(games);
    }
    const games = (rows || []).map(r => enrichGame(r.data));
    res.json(games);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTeams, getTeamById, getTeamMatches };
