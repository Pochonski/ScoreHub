const { pool } = require('../../../database/connection');
const scores365 = require('../../../services/scores365Service');
const images = require('../../../services/images');
const { GROUP_NAMES, transformStandingRow, enrichTeam } = require('../utils/mappers');
const { resolveCompetition } = require('../utils/competition');

async function getStandings(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId, seasonNum } = resolved;

    const { rows } = await pool.query(
      'SELECT data FROM standings WHERE competition_id = $1 AND stage_num = 1 AND season_num = $2',
      [competitionId, seasonNum]
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

function mapBrackets(doc) {
  const bracket = doc?.brackets?.[0];
  if (!bracket?.stages) return [];

  return bracket.stages
    .filter(s => {
      if (s.stageType === 1 || (!s.isFinal && !s.hasBrackets && s.num <= 2)) return false;
      const games = (s.groups || []).flatMap(g => g.games || []);
      return games.length > 0;
    })
    .map(s => {
      const allGames = (s.groups || []).flatMap(g => {
        return (g.games || []).map(gg => {
          const game = gg.game || gg;
          const home = game.homeCompetitor;
          const away = game.awayCompetitor;
          const homeScore = home?.score;
          const awayScore = away?.score;
          return {
            id: game.id || gg.gameId,
            homeTeam: home ? enrichTeam(home) : undefined,
            awayTeam: away ? enrichTeam(away) : undefined,
            score: (homeScore != null && awayScore != null)
              ? { home: homeScore, away: awayScore }
              : undefined,
            startTime: game.startTime || gg.startTime,
            status: game.statusGroup || game.status,
          };
        });
      });
      return {
        name: s.name,
        num: s.num,
        isFinal: s.isFinal || false,
        games: allGames,
      };
    });
}

async function getBrackets(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    if (!resolved.comp.hasBrackets) {
      // Devolver empty array en lugar de 404 — la UI ya muestra empty state.
      return res.json([]);
    }

    const { rows } = await pool.query('SELECT data FROM brackets WHERE competition_id = $1', [competitionId]);
    if (rows.length) {
      const stages = mapBrackets(rows[0].data);
      if (stages.length) return res.json(stages);
    }

    try {
      const live = await scores365.getBrackets(competitionId);
      const stages = mapBrackets(live);
      if (stages.length) return res.json(stages);
    } catch (_) { /* fallthrough */ }

    res.json([]);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStandings, getBrackets };
