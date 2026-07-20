const { pool } = require('../../../database/connection');
const images = require('../../../services/images');
const { GROUP_NAMES, transformStandingRow, enrichTeam } = require('../utils/mappers');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);
const CURRENT_SEASON = parseInt(process.env.PRIMARY_SEASON || '25', 10);

async function getStandings(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM standings WHERE competition_id = $1 AND stage_num = 1 AND season_num = $2',
      [COMPETITION_ID, CURRENT_SEASON]
    );
    if (!rows.length) return res.json([]);

    const apiData = rows[0].data;
    if (!apiData?.standings?.length) return res.json([]);

    const standings = apiData.standings[0].rows || [];
    const groupsMap = new Map();

    standings.forEach(r => {
      const gn = r.groupNum || 1;
      if (!groupsMap.has(gn)) {
        groupsMap.set(gn, { name: GROUP_NAMES[gn - 1] || `Grupo ${gn}`, rows: [] });
      }
      groupsMap.get(gn).rows.push(transformStandingRow(r, r.competitor?.id));
    });

    const groups = Array.from(groupsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, g]) => ({
        ...g,
        rows: g.rows.sort((a, b) => a.position - b.position),
      }));

    res.json(groups);
  } catch (err) {
    next(err);
  }
}

async function getBrackets(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT data FROM brackets WHERE competition_id = $1', [COMPETITION_ID]);
    if (!rows.length) return res.json([]);

    const doc = rows[0].data;
    const bracket = doc?.brackets?.[0];
    if (!bracket?.stages) return res.json([]);

    const stages = bracket.stages.map(s => ({
      name: s.name,
      num: s.num,
      isFinal: s.isFinal || false,
      games: (s.games || []).map(g => ({
        id: g.id,
        homeTeam: g.homeCompetitor ? enrichTeam(g.homeCompetitor) : undefined,
        awayTeam: g.awayCompetitor ? enrichTeam(g.awayCompetitor) : undefined,
        score: g.homeCompetitor?.score != null ? { home: g.homeCompetitor.score, away: g.awayCompetitor?.score } : undefined,
        startTime: g.startTime,
        status: g.status,
      })),
    }));
    res.json(stages);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStandings, getBrackets };
