const db = require('../../../database/db');
const { resolveCompetition } = require('../utils/competition');
const { enrichTrend } = require('../utils/mappers');

async function getCompetitionTrends(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    const { data, error } = await db.query('trends', {
      select: 'data',
      eq: { scope: 'competition', entity_id: competitionId },
      limit: 200,
    });
    if (error) throw error;

    const trends = (data || []).map(r => r.data);
    const seen = new Set();
    const unique = trends.filter(t => {
      const key = `${t.betCTA || ''}|${t.lineTypeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json(unique.slice(0, 10).map(enrichTrend));
  } catch (err) {
    next(err);
  }
}

module.exports = { getCompetitionTrends };
