const db = require('../../../database/db');
const images = require('../../../services/images');
const { enrichGame } = require('../utils/mappers');
const { resolveCompetition } = require('../utils/competition');

async function getTeams(req, res, next) {
  try {
    const nationalOnly = req.query.national === 'true';
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId, seasonNum } = resolved;

    // Phase 5: filter by competition_competitors junction table (Phase 3.1).
    // The junction table is maintained by syncService and represents actual
    // active participation, immune to the competitors.competition_id
    // overwrite issue.
    const idsRows = await db.execAdvanced(
      `SELECT competitor_id FROM competition_competitors
        WHERE competition_id = $1 AND season_num = $2`,
      [competitionId, seasonNum]
    );
    const competitorIds = idsRows.map(r => r.competitor_id);
    const { data: rows, error } = await db.query('competitors', {
      select: 'id, name, data',
      in: { id: competitorIds.length ? competitorIds : [0] },
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

// Auditoría 2026-Q3 S8: escape de LIKE wildcards (igual que athletes).
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, '\\$&');
}

/**
 * GET /teams/search?q=madrid — búsqueda global de equipos (slim, sin comp).
 * Para el buscador global del navbar. ILIKE con escape, límite 10.
 */
async function searchTeams(req, res, next) {
  try {
    const q = String(req.query.q || req.query.search || '').trim();
    if (q.length < 2) return res.json([]);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const rows = await db.execAdvanced(
      `SELECT id, name, data->>'shortName' as "shortName", data->>'imageVersion' as "imageVersion", data->>'countryId' as "countryId"
         FROM competitors
        WHERE name ILIKE $1
        ORDER BY length(name) ASC, name ASC
        LIMIT $2`,
      [`%${escapeLike(q)}%`, limit]
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        shortName: r.shortName || null,
        countryId: r.countryId != null ? Number(r.countryId) : null,
        badgeUrl: images.getTeamBadgeUrl(r.id, Number(r.imageVersion) || 1),
      }))
    );
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

    // Get all competition_ids that this team participated in via the
    // junction table (Phase 5). Then look up games for those comps.
    const ccRows = await db.execAdvanced(
      `SELECT DISTINCT competition_id FROM competition_competitors WHERE competitor_id = $1`,
      [tid]
    );
    const compIds = ccRows.map(r => r.competition_id);
    if (!compIds.length) return res.json([]);

    // Auditoría 2026-Q3 S3: refactor a SQL parametrizado puro.
    // Antes usaba PostgREST `or: '(home_competitor_id.eq.${tid},...)'` que era
    // string-templated. Ahora SQL nativo con placeholders $N.
    const rows = await db.execAdvanced(
      `SELECT data FROM games
        WHERE competition_id = ANY($1::int[])
          AND (home_competitor_id = $2 OR away_competitor_id = $2)
        ORDER BY start_time DESC LIMIT 200`,
      [compIds, tid]
    );
    const games = rows.map(r => enrichGame(r.data));
    res.json(games);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTeams, getTeamById, getTeamMatches, searchTeams };
