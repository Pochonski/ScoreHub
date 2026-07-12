const path = require('path');
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));

const LINE_TYPE_LABELS = {
  1: 'Ganador',
  3: 'Over/Under',
  7: 'Primer gol',
  12: 'Ambos marcan',
  14: 'Doble oportunidad',
};

const SCORE_STAT_IDS = {
  1: 'Goles',
  6: 'Córners',
  14: 'Tiros',
  15: 'Tiros al arco',
  21: 'Fueras de juego',
  31: 'Tarjetas amarillas',
  32: 'Tarjetas rojas',
  41: 'Posesión %',
  43: 'Pases totales',
  52: 'Faltas',
};

const GROUP_NAMES = [
  'Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
  'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L',
];

const SEASON_TO_YEAR = {
  1: 1930, 2: 1934, 3: 1938, 4: 1950, 5: 1954, 6: 1958, 7: 1962, 8: 1966,
  9: 1970, 10: 1974, 11: 1978, 12: 1982, 13: 1986, 14: 1990, 15: 1994,
  16: 1998, 17: 2002, 18: 2006, 19: 2010, 20: 2014, 21: 2018, 22: 2022,
};

function enrichTeam(competitor, imageVersion) {
  if (!competitor) return null;
  return {
    id: competitor.id,
    name: competitor.name,
    shortName: competitor.shortName,
    score: competitor.score != null && competitor.score >= 0 ? competitor.score : undefined,
    badgeUrl: competitor.id ? images.getTeamBadgeUrl(competitor.id, imageVersion || competitor.imageVersion || 1) : null,
    flagUrl: competitor.countryId ? images.getCountryFlagUrl(competitor.countryId) : null,
  };
}

function enrichAthlete(athlete) {
  if (!athlete) return null;
  return {
    ...athlete,
    photoUrl: athlete.id ? images.getAthletePhotoUrl(athlete.id, athlete.imageVersion) : null,
    thumbnailUrl: athlete.id ? images.getAthleteThumbUrl(athlete.id, athlete.imageVersion) : null,
  };
}

function enrichGame(game) {
  if (!game) return null;
  const homeComp = game.homeCompetitor || {};
  const awayComp = game.awayCompetitor || {};
  return {
    id: game.id,
    competitionId: game.competitionId,
    statusGroup: game.statusGroup,
    status: game.statusGroup === 1 ? 'live' : game.statusGroup === 2 ? 'upcoming' : game.statusGroup === 4 ? 'finished' : 'upcoming',
    stage: game.stageName || '',
    stageName: game.stageName || '',
    groupNum: game.groupNum,
    startTime: game.startTime,
    statusText: game.statusText || null,
    minute: game.minute || game.statusText ? parseInt(game.statusText) || null : null,
    homeTeam: enrichTeam(homeComp, game.homeCompetitor?.imageVersion),
    awayTeam: enrichTeam(awayComp, game.awayCompetitor?.imageVersion),
  };
}

function enrichTrend(t) {
  return {
    text: t.text,
    percentage: t.percentage,
    betCTA: t.betCTA || LINE_TYPE_LABELS[t.lineTypeId] || '',
    lineTypeId: t.lineTypeId,
    lineTypeLabel: LINE_TYPE_LABELS[t.lineTypeId] || `Tipo ${t.lineTypeId}`,
  };
}

function enrichTip(tipDoc) {
  if (!tipDoc) return null;
  return {
    gameId: tipDoc.gameId,
    confidenceScore: tipDoc.confidenceScore,
    generatedAt: tipDoc.generatedAt,
    topTrends: (tipDoc.topTrends || []).map(enrichTrend),
    allTrends: (tipDoc.allTrends || []).map(enrichTrend),
  };
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Costa_Rica',
    });
  } catch { return iso; }
}

function extractLineup(competitor) {
  if (!competitor?.lineups?.members?.length) return null;
  const members = (competitor.lineups.members || []).filter(m => m.athleteId || m.name);
  if (!members.length) return null;
  return {
    formation: competitor.lineups.formation || '',
    members: members.map(m => ({
      athleteId: m.athleteId || m.id,
      name: m.name,
      shortName: m.shortName,
      position: m.position?.name || m.positionName || '',
      shirtNumber: m.shirtNumber,
      photoUrl: (m.athleteId || m.id) ? images.getAthleteThumbUrl(m.athleteId || m.id) : null,
      rating: m.rating,
    })),
  };
}

function enrichTransferWithTeam(t, teamMap) {
  const id = String(t.competitorId);
  const info = teamMap[id];
  return {
    ...t,
    competitorName: info?.name || null,
    competitorBadge: info ? images.getTeamBadgeUrl(t.competitorId, info.imageVersion) : null,
  };
}

function buildMatchupId(game) {
  if (!game) return '';
  const homeId = game.homeCompetitor?.id || game.homeTeam?.id;
  const awayId = game.awayCompetitor?.id || game.awayTeam?.id;
  if (!homeId || !awayId) return '';
  const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
  return `${homeId}-${awayId}-${game.competitionId || MUNDIAL_ID}`;
}

function transformStandingRow(r, competitorId) {
  const form = (r.detailedRecentForm || []).slice(0, 5).map(m => {
    const homeId = m.homeCompetitor?.id;
    const awayId = m.awayCompetitor?.id;
    if (m.winner === 0) return 'D';
    if (competitorId == null) return '';
    if (m.winner === 1 && homeId === competitorId) return 'W';
    if (m.winner === 2 && awayId === competitorId) return 'W';
    return 'L';
  }).filter(Boolean);

  return {
    position: r.position || 0,
    team: {
      id: r.competitor?.id,
      name: r.competitor?.name || '',
      badgeUrl: r.competitor?.id ? images.getTeamBadgeUrl(r.competitor.id, r.competitor.imageVersion || 1) : null,
    },
    played: r.gamePlayed || r.gamesPlayed || 0,
    won: r.gamesWon || 0,
    drawn: r.gamesEven || 0,
    lost: r.gamesLost || 0,
    goalsFor: r.for || r.goalsFor || 0,
    goalsAgainst: r.against || r.goalsAgainst || 0,
    goalDiff: r.ratio != null ? r.ratio : ((r.for || 0) - (r.against || 0)),
    points: r.points || 0,
    recentForm: form,
  };
}

function parseHistoryDoc(d, teamMap) {
  const participants = (d.group?.participants || []).map(p => ({
    name: p.name,
    competitorId: p.competitorId,
    badgeUrl: p.competitorId ? images.getTeamBadgeUrl(p.competitorId, teamMap[String(p.competitorId)]?.imageVersion) : null,
  }));
  const game = d.group?.games?.[0];
  const gameData = game?.game || game;
  const year = game?.startTime ? new Date(game.startTime).getFullYear() : (SEASON_TO_YEAR[d.seasonNum] || d.seasonNum + 1930 - 1);
  const hostMatch = d.title ? d.title.match(/^(.+?)\s+\d{4}$/) : null;

  return {
    seasonNum: d.seasonNum,
    year,
    title: d.title || null,
    secondaryTitle: d.secondaryTitle || null,
    host: hostMatch ? hostMatch[1].trim() : null,
    entityId: d.entityId || null,
    matchId: gameData?.id || null,
    homeScore: gameData?.homeCompetitor?.score != null ? gameData.homeCompetitor.score : null,
    awayScore: gameData?.awayCompetitor?.score != null ? gameData.awayCompetitor.score : null,
    homePenaltyScore: gameData?.homeCompetitor?.penaltyScore != null ? gameData.homeCompetitor.penaltyScore : null,
    awayPenaltyScore: gameData?.awayCompetitor?.penaltyScore != null ? gameData.awayCompetitor.penaltyScore : null,
    extraTime: gameData?.homeCompetitor?.score != null && gameData?.awayCompetitor?.score != null
      && gameData?.homeCompetitor?.score === gameData?.awayCompetitor?.score
      && gameData?.winner !== 0 ? true : null,
    penalties: gameData?.homeCompetitor?.penaltyScore != null || gameData?.awayCompetitor?.penaltyScore != null ? true : null,
    champion: d.champion ? {
      name: d.champion.name,
      competitorId: d.champion.competitorId,
      badgeUrl: d.champion.competitorId ? images.getTeamBadgeUrl(d.champion.competitorId, teamMap[String(d.champion.competitorId)]?.imageVersion) : null,
    } : participants[0] ? {
      name: participants[0].name,
      competitorId: participants[0].competitorId,
      badgeUrl: participants[0].badgeUrl,
    } : (gameData?.homeCompetitor?.isWinner ? {
      name: gameData.homeCompetitor.name,
      competitorId: gameData.homeCompetitor.id,
      badgeUrl: gameData.homeCompetitor.id ? images.getTeamBadgeUrl(gameData.homeCompetitor.id, teamMap[String(gameData.homeCompetitor.id)]?.imageVersion) : null,
    } : (gameData?.awayCompetitor?.isWinner ? {
      name: gameData.awayCompetitor.name,
      competitorId: gameData.awayCompetitor.id,
      badgeUrl: gameData.awayCompetitor.id ? images.getTeamBadgeUrl(gameData.awayCompetitor.id, teamMap[String(gameData.awayCompetitor.id)]?.imageVersion) : null,
    } : null)),
    runnerUp: d.runnerUp ? {
      name: d.runnerUp.name,
      competitorId: d.runnerUp.competitorId,
      badgeUrl: d.runnerUp.competitorId ? images.getTeamBadgeUrl(d.runnerUp.competitorId, teamMap[String(d.runnerUp.competitorId)]?.imageVersion) : null,
    } : participants[1] ? {
      name: participants[1].name,
      competitorId: participants[1].competitorId,
      badgeUrl: participants[1].badgeUrl,
    } : gameData?.homeCompetitor && gameData?.awayCompetitor ? (gameData.homeCompetitor.isWinner ? {
      name: gameData.awayCompetitor.name,
      competitorId: gameData.awayCompetitor.id,
      badgeUrl: gameData.awayCompetitor.id ? images.getTeamBadgeUrl(gameData.awayCompetitor.id, teamMap[String(gameData.awayCompetitor.id)]?.imageVersion) : null,
    } : {
      name: gameData.homeCompetitor.name,
      competitorId: gameData.homeCompetitor.id,
      badgeUrl: gameData.homeCompetitor.id ? images.getTeamBadgeUrl(gameData.homeCompetitor.id, teamMap[String(gameData.homeCompetitor.id)]?.imageVersion) : null,
    }) : null,
    venue: game?.venue?.name || null,
    venueShortName: game?.venue?.shortName || null,
    startTime: game?.startTime || null,
    hasTable: d.hasTable || false,
    group: d.group ? {
      name: d.group.name || '',
      participants,
      games: (d.group.games || []).map(g => {
        const gd = g.game || g;
        return {
          num: g.num,
          gameId: gd?.id || g.gameId,
          startTime: g.startTime,
          venue: g.venue ? { name: g.venue.name, shortName: g.venue.shortName } : null,
          homeCompetitor: gd?.homeCompetitor ? {
            id: gd.homeCompetitor.id,
            name: gd.homeCompetitor.name,
            score: gd.homeCompetitor.score,
            penaltyScore: gd.homeCompetitor.penaltyScore,
            isWinner: gd.homeCompetitor.isWinner || false,
            badgeUrl: gd.homeCompetitor.id ? images.getTeamBadgeUrl(gd.homeCompetitor.id, teamMap[String(gd.homeCompetitor.id)]?.imageVersion) : null,
          } : null,
          awayCompetitor: gd?.awayCompetitor ? {
            id: gd.awayCompetitor.id,
            name: gd.awayCompetitor.name,
            score: gd.awayCompetitor.score,
            penaltyScore: gd.awayCompetitor.penaltyScore,
            isWinner: gd.awayCompetitor.isWinner || false,
            badgeUrl: gd.awayCompetitor.id ? images.getTeamBadgeUrl(gd.awayCompetitor.id, teamMap[String(gd.awayCompetitor.id)]?.imageVersion) : null,
          } : null,
        };
      }),
      venue: game?.venue?.name || null,
    } : null,
  };
}

module.exports = {
  LINE_TYPE_LABELS,
  SCORE_STAT_IDS,
  GROUP_NAMES,
  SEASON_TO_YEAR,
  enrichTeam,
  enrichAthlete,
  enrichGame,
  enrichTrend,
  enrichTip,
  formatTime,
  extractLineup,
  enrichTransferWithTeam,
  buildMatchupId,
  transformStandingRow,
  parseHistoryDoc,
};
