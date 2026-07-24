const db = require('../../../database/db');
const scores365 = require('../../../services/scores365Service');
const images = require('../../../services/images');
const { GROUP_NAMES, transformStandingRow, enrichTeam } = require('../utils/mappers');
const { resolveCompetition } = require('../utils/competition');

async function getStandings(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId, seasonNum } = resolved;

    const stageNum = req.query.stageNum != null ? parseInt(req.query.stageNum, 10) : 1;
    const requestedSeason = req.query.seasonNum != null ? parseInt(req.query.seasonNum, 10) : seasonNum;

    // The standings table has a UNIQUE (competition_id, stage_num, season_num) index
    // so this composite eq filter is a single-row lookup. Single-row returns via .maybeSingle().
    const { data, error } = await db.query('standings', {
      select: 'data',
      eq: {
        competition_id: competitionId,
        stage_num: stageNum,
        season_num: requestedSeason,
      },
      maybeSingle: true,
    });
    if (error) throw error;

    if (data) {
      const stagesArr = data.data?.standings ?? [];
      if (stagesArr.length) {
        const standings = stagesArr[0].rows || [];
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
            displayName: stagesArr[0].displayName,
            isCurrentStage: stagesArr[0].isCurrentStage,
            rows: g.rows.sort((a, b) => a.position - b.position),
          }));

        return res.json(groups);
      }
    }

    try {
      const live = await scores365.getStandings(competitionId, stageNum, requestedSeason);
      const stagesArr = live?.standings ?? [];
      if (!stagesArr.length) return res.json([]);

      const standings = stagesArr[0].rows || [];
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
          displayName: stagesArr[0].displayName,
          isCurrentStage: stagesArr[0].isCurrentStage,
          rows: g.rows.sort((a, b) => a.position - b.position),
        }));
      return res.json(groups);
    } catch (_) {
      return res.json([]);
    }
  } catch (err) {
    next(err);
  }
}

async function getStandingsSeasons(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId, seasonNum } = resolved;

    const { data, error } = await db.query('standings', {
      select: 'data',
      eq: { competition_id: competitionId },
      order: { column: 'season_num', asc: false },
      limit: 1,
      maybeSingle: true,
    });
    if (error) throw error;

    if (data) {
      const sf = data.data?.seasonsFilter;
      if (Array.isArray(sf)) return res.json(sf);
    }

    try {
      const live = await scores365.getStandings(competitionId, 1, seasonNum, { withSeasonsFilter: true });
      const sf = live?.seasonsFilter;
      if (Array.isArray(sf)) return res.json(sf);
    } catch (_) { /* fallthrough */ }

    res.json([]);
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
      return res.json([]);
    }

    const { data, error } = await db.query('brackets', {
      select: 'data',
      eq: { competition_id: competitionId },
      maybeSingle: true,
    });
    if (error) throw error;

    if (data) {
      const stages = mapBrackets(data.data);
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

module.exports = { getStandings, getBrackets, getStandingsSeasons };
