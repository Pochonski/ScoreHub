const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const { enrichTrend } = require('../utils/mappers');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);

async function getCompetitionTrends(req, res, next) {
  try {
    const trends = await cosmos.queryAll('trends', {
      query: `SELECT * FROM c WHERE c.scope = 'competition' AND c.competitionId = ${MUNDIAL_ID} ORDER BY c.percentage DESC`,
    });

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
