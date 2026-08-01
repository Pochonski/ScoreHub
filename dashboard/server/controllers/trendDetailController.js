const db = require('../../../database/db');
const scores365 = require('../../../services/scores365Service');

/**
 * GET /trends/details?trendId=12345
 * Detalle completo de un trend: texto, causa, juegos de soporte con outcome.
 *
 * DB_ONLY desde migration 020 (Fase 8.3). Si no hay datos en DB, hydrate
 * desde upstream y persistir (cache-with-hydration, mismo patrón que athletes).
 */
async function getTrendDetails(req, res, next) {
  try {
    const trendId = parseInt(req.query.trendId, 10);
    if (!Number.isFinite(trendId)) return res.status(400).json({ error: 'trendId inválido' });

    // 1. Intentar DB
    const { data: row, error } = await db.query('trend_details', {
      select: 'data',
      eq: { trend_id: trendId },
      maybeSingle: true,
    });
    if (error) throw error;
    if (row?.data?.trend) {
      const data = row.data;
      return res.json({
        trend: data.trend,
        games: (data.games ?? []).map((g) => ({
          game: g.game,
          outcome: g.outcome,
          competitionId: g.competitionId,
        })),
      });
    }

    // 2. Cache miss: hydrate desde 365scores y persistir.
    try {
      const data = await scores365.getTrendDetails(trendId);
      const trend = data?.trend ?? null;
      if (!trend) return res.json({ trend: null, games: [] });
      await db.upsert('trend_details', [{
        trend_id: Number(trend.id),
        data: JSON.stringify(data),
      }], 'trend_id');
      return res.json({
        trend,
        games: (data.games ?? []).map((g) => ({
          game: g.game,
          outcome: g.outcome,
          competitionId: g.competitionId,
        })),
      });
    } catch (upstreamErr) {
      // Upstream falló: devolver vacío en lugar de error.
      return res.json({ trend: null, games: [] });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { getTrendDetails };