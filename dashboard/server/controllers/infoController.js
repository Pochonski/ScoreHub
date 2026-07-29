const db = require('../../../database/db');
const images = require('../../../services/images');
const scores365 = require('../../../services/scores365Service');
const { resolveCompetition, getActiveCompetitions, getActiveCompetitionIds, loadActiveCompetitions } = require('../utils/competition');

const DEFAULT_SEASON = parseInt(process.env.PRIMARY_SEASON || '25', 10);

async function getCountries(req, res, next) {
  try {
    const { data, error } = await db.query('countries', {
      select: 'id, name',
      order: { column: 'name', asc: true },
    });
    if (error) throw error;
    const countries = (data || []).map(r => ({
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

    const { data, error } = await db.query('competitions', {
      select: 'data',
      eq: { id: competitionId },
      maybeSingle: true,
    });
    if (error) throw error;
    if (!data) {
      return res.json({
        id: competitionId,
        name: comp.displayName,
        seasonNum,
        format: 'Sin detalle disponible',
      });
    }
    const clist = data.data?.competitions;
    const c = Array.isArray(clist) ? clist[0] : data.data?.competition;
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

    // DB-first con write-back (Fase 8.4).
    const { data: row } = await db.readThrough(
      'competitions',
      { select: 'data', eq: { id }, maybeSingle: true },
      async () => {
        const live = await scores365.getCompetition(id);
        if (!live) return null;
        return { id, data: JSON.stringify(live) };
      },
      { onConflict: 'id', ttlMs: 6 * 60 * 60 * 1000 }, // 6h
    );

    if (row?.data) {
      const c = row.data?.competitions?.[0] || row.data?.competition;
      if (c) {
        return res.json({
          ...comp,
          upstream: c,
          hasTransfers: !!c.hasTransfers,
          seasons: c.seasons || [],
        });
      }
    }

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

    // DB-first con write-back (Fase 8.4) — comparte fila con getCompetitionDetail.
    const { data: row } = await db.readThrough(
      'competitions',
      { select: 'data', eq: { id }, maybeSingle: true },
      async () => {
        const live = await scores365.getCompetition(id);
        if (!live) return null;
        return { id, data: JSON.stringify(live) };
      },
      { onConflict: 'id', ttlMs: 6 * 60 * 60 * 1000 }, // 6h
    );

    const c = row?.data?.competitions?.[0] || row?.data?.competition;
    if (c?.seasons?.length) return res.json(c.seasons);
    return res.json([]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /competitions/:id/insights
 * Bundle completo de insights de una competición para el frontend:
 * tendencias, sugerencias (top upcoming games), outrights (campeón), top scorers
 * y próximos partidos destacados. Sirve para alimentar la pestaña "Análisis"
 * sin hacer 6 requests separados.
 *
 * Si una sección está vacía (porque la temporada aún no comienza), devolvemos
 * `count: 0` o `null` en vez de `[]`, para que el frontend pueda mostrar
 * un empty-state específico ("Se actualizará cuando arranque la temporada").
 *
 * Implementación Fase 4: cada sección usa Supabase JS (HTTP) cuando la
 * query es simple, y cae a execAdvanced (pg) cuando necesita filtros
 * sobre JSONB o rangos sobre datos compuestos.
 */
async function getCompetitionInsights(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const competitionId = resolved.competitionId;
    const comp = resolved.comp;

    // Tendencias (competition-level). El ORDER BY sobre JSONB no se puede
    // expresar con PostgREST simple, así que usamos execAdvanced.
    const trendsRows = await db.execAdvanced(
      `SELECT data FROM trends
        WHERE scope = $1 AND entity_id = $2
        ORDER BY (data->>'percentage')::numeric DESC NULLS LAST
        LIMIT 10`,
      ['competition', competitionId]
    );
    const trends = trendsRows.map(r => r.data);

    // Sugerencias — single-table with rank, fácil para Supabase.
    const { data: suggData, error: suggErr } = await db.query('game_suggestions', {
      select: 'data',
      eq: { competition_id: competitionId },
      order: { column: 'rank', asc: true },
      limit: 8,
    });
    if (suggErr) throw suggErr;
    const suggestions = (suggData || []).map(r => r.data);

    // Outrights (cuotas de campeón). Single row PK lookup → Supabase.
    const { data: outrightData, error: outrightErr } = await db.query('odds_outrights', {
      select: 'data, updated_at',
      eq: { competition_id: competitionId },
      maybeSingle: true,
    });
    if (outrightErr) throw outrightErr;
    const outrights = {
      available: !!outrightData,
      updatedAt: outrightData?.updated_at ?? null,
      data: outrightData?.data ?? null,
    };

    // Top scorers / assists / ratings desde tournament_stats.
    const { data: statsData, error: statsErr } = await db.query('tournament_stats', {
      select: 'data, updated_at',
      eq: { competition_id: competitionId },
      order: [{ column: 'season_num', asc: false }],
      limit: 1,
      maybeSingle: true,
    });
    if (statsErr) throw statsErr;
    const topStats = statsData
      ? { ...extractTopStats(statsData.data), updatedAt: statsData.updated_at }
      : null;

    // Team of the week (cached en tabla team_of_week). Single row PK.
    const { data: towData, error: towErr } = await db.query('team_of_week', {
      select: 'data, updated_at',
      eq: { competition_id: competitionId },
      maybeSingle: true,
    });
    if (towErr) throw towErr;
    const teamOfWeek = towData
      ? { available: true, updatedAt: towData.updated_at, ...extractTeamOfWeek(towData.data) }
      : { available: false };

    // Próximos partidos destacados — filtro sobre start_time requiere pg.
    const upcomingRows = await db.execAdvanced(
      `SELECT data FROM games
        WHERE competition_id = $1
          AND status_group = 2
          AND start_time > NOW()
        ORDER BY start_time ASC LIMIT 5`,
      [competitionId]
    );
    const upcoming = upcomingRows.map(r => r.data);

    res.json({
      competitionId,
      season: {
        num: comp.seasonNum,
        label: comp.seasonLabel,
        startDate: comp.startDate,
        endDate: comp.endDate,
      },
      trends: { count: trends.length, items: trends },
      suggestions: { count: suggestions.length, items: suggestions },
      outrights,
      topStats,
      teamOfWeek,
      upcoming: { count: upcoming.length, items: upcoming },
    });
  } catch (err) {
    next(err);
  }
}

function extractTeamOfWeek(raw) {
  const lineup = raw?.teamOfTheWeek?.lineup || raw?.teamOfWeek?.lineup || null;
  if (!lineup) return null;
  const formation = lineup.formation || '4-4-2';
  const players = (lineup.members || []).map(m => ({
    name: m.name,
    shortName: m.shortName,
    position: m.position?.name || m.positionName || null,
    jersey: m.jerseyNumber ?? null,
    rating: m.ranking ?? null,
    athleteId: m.athleteId ?? m.id ?? null,
    photoUrl: (m.athleteId || m.id)
      ? `https://imagecache.365scores.com/image/upload/f_png,w_32,h_32,c_limit,q_auto:eco,dpr_3,r_max,c_thumb,g_face,z_0.65,d_Athletes:default.png/v${m.imageVersion || 26}/Athletes/NationalTeam/${m.athleteId || m.id}`
      : null,
  }));
  return { formation, players };
}

/**
 * Extrae top-5 scorers, top-5 assists y top-5 ratings de tournament_stats.
 * El upstream devuelve un objeto con categorías (Goals, Assists, Rating 365).
 */
function extractTopStats(raw) {
  if (!raw?.stats?.athletesStats) return null;
  const cats = Array.isArray(raw.stats.athletesStats)
    ? raw.stats.athletesStats
    : Object.values(raw.stats.athletesStats || {});

  const pickTop = (catId) => {
    const cat = cats.find(c => c.id === catId) || cats.find(c => c.name === catId);
    if (!cat?.rows) return [];
    return cat.rows.slice(0, 5).map(r => ({
      athleteId: r.entity?.id,
      name: r.entity?.name || r.entity?.shortName,
      teamName: r.entity?.competitorName || r.teamName || null,
      photoUrl: r.entity?.id ? `https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_1/v${r.entity.imageVersion || 1}/Athletes/${r.entity.id}` : null,
      value: r.value ?? r.stats?.[0]?.value ?? null,
    }));
  };

  return {
    scorers: pickTop(1),     // Goals
    assists: pickTop(3),     // Assists
    ratings: pickTop(7),     // Rating 365
  };
}

module.exports = {
  getCountries,
  getTournamentInfo,
  getCompetitions,
  getFeaturedCompetitions,
  getCompetitionDetail,
  getCompetitionSeasons,
  getCompetitionInsights,
};
