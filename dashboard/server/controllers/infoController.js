const { pool } = require('../../../database/connection');
const images = require('../../../services/images');
const scores365 = require('../../../services/scores365Service');
const { resolveCompetition, getActiveCompetitions, getActiveCompetitionIds, loadActiveCompetitions } = require('../utils/competition');

const DEFAULT_SEASON = parseInt(process.env.PRIMARY_SEASON || '25', 10);

async function getCountries(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT id, name FROM countries ORDER BY name');
    const countries = rows.map(r => ({
      id: r.id,
      name: r.name || '',
      flagUrl: images.getCountryFlagUrl(r.id),
    }));
    res.json(countries);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /tournament-info?competitionId=5930
 * Devuelve info de una competición específica.
 */
async function getTournamentInfo(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId, seasonNum, comp } = resolved;

    const { rows } = await pool.query('SELECT data FROM competitions WHERE id = $1', [competitionId]);
    if (!rows.length) {
      return res.json({
        id: competitionId,
        name: comp.displayName,
        seasonNum,
        format: 'Sin detalle disponible',
      });
    }
    const clist = rows[0].data?.competitions;
    const c = Array.isArray(clist) ? clist[0] : rows[0].data?.competition;
    if (!c) {
      return res.json({
        id: competitionId,
        name: comp.displayName,
        seasonNum,
        format: 'Sin detalle disponible',
      });
    }
    res.json({
      id: c.id,
      name: c.name || comp.displayName,
      nameForURL: c.nameForURL,
      countryId: c.countryId ?? comp.countryId,
      countryName: comp.countryName,
      seasonNum: c.currentSeasonNum || seasonNum,
      seasonLabel: comp.seasonLabel,
      imageVersion: c.imageVersion,
      hasBrackets: comp.hasBrackets,
      hasGroups: comp.hasGroups,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /competitions
 * Lista de competiciones activas (catálogo del sitio).
 */
async function getCompetitions(req, res, next) {
  try {
    const list = await getActiveCompetitions();
    res.json(list.map(c => ({
      id: c.id,
      displayName: c.displayName,
      shortName: c.shortName,
      countryId: c.countryId,
      countryName: c.countryName,
      seasonNum: c.seasonNum,
      seasonLabel: c.seasonLabel,
      startDate: c.startDate,
      endDate: c.endDate,
      isFeatured: c.isFeatured,
      displayOrder: c.displayOrder,
      hasBrackets: c.hasBrackets,
      hasGroups: c.hasGroups,
      hasHistory: c.hasHistory,
    })));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /competitions/featured
 * Solo las competiciones marcadas is_featured=true (para los tabs de la home).
 */
async function getFeaturedCompetitions(req, res, next) {
  try {
    const list = await getActiveCompetitions();
    res.json(
      list
        .filter(c => c.isFeatured)
        .map(c => ({
          id: c.id,
          displayName: c.displayName,
          shortName: c.shortName,
          countryId: c.countryId,
          countryName: c.countryName,
          seasonNum: c.seasonNum,
          seasonLabel: c.seasonLabel,
          isFeatured: c.isFeatured,
          displayOrder: c.displayOrder,
        }))
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /competitions/:id
 * Detalle completo (incluye seasons[] del upstream). Cacheado en `competitions`.
 */
async function getCompetitionDetail(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const { byId } = await loadActiveCompetitions();
    const comp = byId.get(id);
    if (!comp) return res.status(404).json({ error: 'Competición no disponible' });

    // 1. Cache DB
    const { rows } = await pool.query('SELECT data FROM competitions WHERE id = $1', [id]);
    if (rows.length) {
      const c = rows[0].data?.competitions?.[0] || rows[0].data?.competition;
      if (c) {
        return res.json({
          ...comp,
          upstream: c,
          seasons: c.seasons || [],
        });
      }
    }

    // 2. Fallback a upstream en vivo.
    try {
      const live = await scores365.getCompetition(id);
      const c = live?.competitions?.[0];
      if (c) {
        return res.json({
          ...comp,
          upstream: c,
          seasons: c.seasons || [],
        });
      }
    } catch (_) { /* fallthrough */ }

    res.json({ ...comp, upstream: null, seasons: [] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /competitions/:id/seasons
 * Solo el array `seasons` del upstream.
 */
async function getCompetitionSeasons(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const { byId } = await loadActiveCompetitions();
    if (!byId.has(id)) return res.status(404).json({ error: 'Competición no disponible' });

    const { rows } = await pool.query('SELECT data FROM competitions WHERE id = $1', [id]);
    const c = rows[0]?.data?.competitions?.[0] || rows[0]?.data?.competition;
    if (c?.seasons?.length) return res.json(c.seasons);

    try {
      const live = await scores365.getCompetition(id);
      const c2 = live?.competitions?.[0];
      return res.json(c2?.seasons || []);
    } catch (_) {
      return res.json([]);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCountries,
  getTournamentInfo,
  getCompetitions,
  getFeaturedCompetitions,
  getCompetitionDetail,
  getCompetitionSeasons,
};
