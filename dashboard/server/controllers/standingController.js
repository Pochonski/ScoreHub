const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));
const { GROUP_NAMES, transformStandingRow, enrichTeam } = require('../utils/mappers');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const COMPETITION_PK = String(MUNDIAL_ID);
const CURRENT_SEASON = parseInt(process.env.SCORES365_SEASON || '25', 10);
const scores365 = require(path.join(__dirname, '..', '..', '..', 'services', 'scores365Service'));

async function getStandings(req, res, next) {
  try {
    const query = {
      query: 'SELECT * FROM c WHERE c.competitionId = @compId AND c.stageNum = 1 ORDER BY c.seasonNum DESC',
      parameters: [{ name: '@compId', value: COMPETITION_PK }],
    };
    const docs = await cosmos.queryAll('standings', query);

    if (docs.length > 0) {
      const groups = docs.map(doc => ({
        name: doc.name || GROUP_NAMES[(doc.groupNum || 1) - 1] || `Grupo ${doc.groupNum}`,
        rows: (doc.rows || []).map((r, i) => ({
          position: i + 1,
          team: {
            id: r.competitor?.id,
            name: r.competitor?.name || r.teamName,
            badgeUrl: r.competitor?.id ? images.getTeamBadgeUrl(r.competitor.id, r.competitor.imageVersion || 1) : null,
          },
          played: r.played || r.gamesPlayed || 0,
          won: r.won || r.gamesWon || 0,
          drawn: r.drawn || r.gamesEven || 0,
          lost: r.lost || r.gamesLost || 0,
          goalsFor: r.goalsFor || 0,
          goalsAgainst: r.goalsAgainst || 0,
          goalDiff: (r.goalDiff != null) ? r.goalDiff : ((r.goalsFor || 0) - (r.goalsAgainst || 0)),
          points: r.points || 0,
          recentForm: r.recentForm || (r.form || '').split('') || [],
        })),
      }));
      return res.json(groups);
    }

    const apiData = await scores365.getStandings(MUNDIAL_ID, 1, CURRENT_SEASON);
    if (!apiData?.standings?.length) return res.json([]);

    const rows = apiData.standings[0].rows || [];
    const groupsMap = new Map();

    rows.forEach(r => {
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
    const doc = await cosmos.getById('brackets', String(MUNDIAL_ID), COMPETITION_PK);
    if (!doc?.stages) return res.json([]);

    res.json(doc.stages.map(s => ({
      name: s.name,
      games: (s.games || []).map(g => ({
        id: g.id,
        homeTeam: g.homeCompetitor ? enrichTeam(g.homeCompetitor) : undefined,
        awayTeam: g.awayCompetitor ? enrichTeam(g.awayCompetitor) : undefined,
        score: g.homeCompetitor?.score != null ? { home: g.homeCompetitor.score, away: g.awayCompetitor?.score } : undefined,
        startTime: g.startTime,
      })),
    })));
  } catch (err) {
    next(err);
  }
}

module.exports = { getStandings, getBrackets };
