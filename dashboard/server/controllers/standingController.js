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

    // DB-first con write-back (Fase 8.4).
    const { data: row } = await db.readThrough(
      'standings',
      {
        select: 'data',
        eq: {
          competition_id: competitionId,
          stage_num: stageNum,
          season_num: requestedSeason,
        },
        maybeSingle: true,
      },
      async () => {
        const live = await scores365.getStandings(competitionId, stageNum, requestedSeason);
        if (!live?.standings?.length) return null;
        return {
          competition_id: competitionId,
          stage_num: stageNum,
          season_num: requestedSeason,
          data: JSON.stringify(live),
        };
      },
      { onConflict: 'competition_id,stage_num,season_num', ttlMs: 2 * 60 * 1000 },
    );

    if (row?.data) {
      const stagesArr = row.data?.standings ?? [];
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

    res.json([]);
  } catch (err) {
    next(err);
  }
}

async function getStandingsSeasons(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId, seasonNum } = resolved;

    // DB-first con write-back (Fase 8.4).
    // Fase 8.7+ fix: hay múltiples filas de standings por comp (syncStandings
    // hace 2 requests, type=1 y type=2). El `seasonsFilter` solo está en
    // la respuesta de `getStandings` con `withSeasonsFilter: true` (type=1).
    // Buscamos la fila que tenga `seasonsFilter` presente.
    const { data: row } = await db.readThrough(
      'standings',
      {
        select: 'data',
        eq: { competition_id: competitionId },
        order: { column: 'season_num', asc: false },
        limit: 1,
        maybeSingle: true,
      },
      async () => {
        const live = await scores365.getStandings(competitionId, 1, seasonNum, { withSeasonsFilter: true });
        if (!live) return null;
        return {
          competition_id: competitionId,
          stage_num: 1,
          season_num: seasonNum,
          data: JSON.stringify(live),
        };
      },
      { onConflict: 'competition_id,stage_num,season_num', ttlMs: 6 * 60 * 60 * 1000 },
    );

    if (row?.data) {
      const sf = row.data?.seasonsFilter;
      if (Array.isArray(sf)) return res.json(sf);
    }

    // Fase 8.7+ fallback: si la fila preferida no tiene seasonsFilter, intentar
    // otra fila (puede haber varias para la misma comp con diferentes stages).
    try {
      const allRows = await db.execAdvanced(
        `SELECT data FROM standings
         WHERE competition_id = $1
           AND data ? 'seasonsFilter'
         ORDER BY season_num DESC
         LIMIT 1`,
        [competitionId]
      );
      for (const r of allRows) {
        const sf = r.data?.seasonsFilter;
        if (Array.isArray(sf)) return res.json(sf);
      }
    } catch (_) {
      /* ignore */
    }

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

    // DB-first con write-back (Fase 8.4).
    const { data: row } = await db.readThrough(
      'brackets',
      { select: 'data', eq: { competition_id: competitionId }, maybeSingle: true },
      async () => {
        const live = await scores365.getBrackets(competitionId);
        if (!live) return null;
        return { competition_id: competitionId, data: JSON.stringify(live) };
      },
      { onConflict: 'competition_id', ttlMs: 4 * 60 * 60 * 1000 },
    );

    if (row?.data) {
      const stages = mapBrackets(row.data);
      if (stages.length) return res.json(stages);
    }

    res.json([]);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStandings, getBrackets, getStandingsSeasons };
