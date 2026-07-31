const path = require('path');
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));

const LINE_TYPE_LABELS = {
  1: 'Ganador',
  3: 'Over/Under',
  5: '1er tiempo',
  7: 'Primer gol',
  12: 'Ambos marcan',
  14: 'Doble oportunidad',
};

// IDs reales de 365scores (extraídos del HAR del partido 4773219).
// Antes teníamos IDs inventados que no coincidían con los del upstream.
const SCORE_STAT_IDS = {
  1: 'Tarjetas amarillas',
  2: 'Tarjetas rojas',
  3: 'Tiros',
  4: 'Tiros al arco',
  5: 'Tiros desviados',
  6: 'Tiros bloqueados',
  8: 'Córners',
  9: 'Fueras de juego',
  10: 'Posesión %',
  12: 'Faltas',
  13: 'Tiros libres',
  14: 'Saques de arco',
  15: 'Saques de banda',
  19: 'Pases completados',
  21: 'Pases totales',
  23: 'Atajadas',
  24: 'Grandes oportunidades creadas',
  36: 'Grandes oportunidades falladas',
  37: 'Recibió faltas',
  40: 'Despejes',
  41: 'Intercepciones',
  46: 'Pases clave',
  51: 'Duelos por el suelo ganados',
  52: 'Centros completados',
  53: 'Pases largos completados',
  54: 'Regates exitosos',
  55: 'Duelos por el suelo ganados',
  56: 'Duelos aéreos ganados',
  60: 'Superado en regate',
  73: 'Pérdidas de balón',
  76: 'Goles esperados (xG)',
  77: 'xG recibido',
  78: 'Asistencias esperadas (xA)',
  79: 'Tiros a puerta esperados',
  80: 'Pases al último tercio',
  81: 'Pases hacia atrás',
  84: 'Recuperaciones en último tercio',
  146: 'Tiros dentro del área',
  147: 'Tiros fuera del área',
  148: 'Pases en campo propio',
  149: 'Pases en campo rival',
  150: 'Duelos ganados',
};

// Stats que 365scores marca como isMajor=true: las 4 destacadas arriba
// (Tiros, Tiros al arco, Posesión, xG). Tipo ESPN/365scores.
const MAJOR_STAT_IDS = new Set([3, 4, 10, 76]);

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
  const members = (competitor.lineups.members || []).filter(m => m.athleteId || m.id || m.name);
  if (!members.length) return null;
  return {
    formation: competitor.lineups.formation || '',
    members: members.map(m => {
      const athleteId = m.athleteId || m.id;
      return {
        athleteId,
        name: m.name,
        shortName: m.shortName,
        position: m.position?.name || m.positionName || '',
        shirtNumber: m.shirtNumber,
        photoUrl: athleteId ? images.getAthleteThumbUrl(athleteId) : null,
        rating: m.rating,
      };
    }),
  };
}

/**
 * Construye el objeto { home, away } de alineaciones a partir de la respuesta
 * del endpoint dedicado /web/athletes/games/lineups.
 *
 * Cada member del upstream tiene:
 *   { id, athleteId, name, shortName, jerseyNumber, imageVersion,
 *     competitorNum (1=home, 2=away), competitorId,
 *     position: { name }, formation: { name, shortName },
 *     status (1=titular, 2=suplente, 3=no disponible),
 *     ranking (rating), stats[], yardFormation, heatMap }
 *
 * El overview no trae names/athleteIds; por eso este endpoint es necesario.
 */
function buildLineups(lineupsData, homeId, awayId) {
  if (!lineupsData) return null;
  const allMembers = lineupsData.members || lineupsData.lineups?.members || [];
  if (!allMembers.length) return null;

  const home = [];
  const away = [];
  let homeFormation = '';
  let awayFormation = '';

  for (const m of allMembers) {
    // Determinar bando: competitorNum (1=home, 2=away) o competitorId directo.
    let side;
    if (m.competitorNum === 1 || m.competitorId === homeId) side = 'home';
    else if (m.competitorNum === 2 || m.competitorId === awayId) side = 'away';
    else continue;

    const athleteId = m.athleteId || m.id;
    const member = {
      athleteId,
      name: m.name || m.shortName || '',
      shortName: m.shortName || m.name || '',
      position: m.formation?.shortName || m.formation?.name || m.position?.name || '',
      shirtNumber: m.jerseyNumber ?? m.shirtNumber,
      photoUrl: athleteId ? images.getAthleteThumbUrl(athleteId, m.imageVersion || 26) : null,
      rating: m.ranking ?? m.rating,
      isStarter: m.status === 1 || m.statusText === 'Starting',
    };
    if (side === 'home') {
      home.push(member);
      if (m.formation && !homeFormation) homeFormation = ''; // se setea abajo
    } else {
      away.push(member);
    }
  }

  // Extraer formation del objeto lineups si existe estructura anidada.
  if (lineupsData.lineups) {
    homeFormation = lineupsData.lineups.home?.formation || lineupsData.lineups.homeFormation || '';
    awayFormation = lineupsData.lineups.away?.formation || lineupsData.lineups.awayFormation || '';
  }

  if (!home.length && !away.length) return null;

  return {
    home: home.length ? { formation: homeFormation, members: home } : null,
    away: away.length ? { formation: awayFormation, members: away } : null,
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
  const COMPETITION_ID = require('../../../services/config').PRIMARY_COMPETITION_ID;
  return `${homeId}-${awayId}-${game.competitionId || COMPETITION_ID}`;
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

  // nextMatch: trae el próximo partido del upstream con home/away.
  // Si este equipo es home, opponent = away; si away, opponent = home.
  let nextMatch;
  if (r.nextMatch?.id) {
    const home = r.nextMatch.homeCompetitor;
    const away = r.nextMatch.awayCompetitor;
    const isHome = home?.id === competitorId;
    const opp = isHome ? away : home;
    if (opp) {
      nextMatch = {
        id: r.nextMatch.id,
        startTime: r.nextMatch.startTime,
        isHome,
        roundNum: r.nextMatch.roundNum,
        competitionDisplayName: r.nextMatch.competitionDisplayName,
        opponent: {
          id: opp.id,
          name: opp.name || '',
          badgeUrl: opp.id
            ? images.getTeamBadgeUrl(opp.id, opp.imageVersion || 1)
            : null,
        },
      };
    }
  }

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
    trend: typeof r.trend === 'number' ? r.trend : null,
    hasPointsDeduction: r.hasPointsDeduction === true,
    nextMatch,
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
  // Year: prefer startTime from final game; otherwise parse from seasonName;
  // otherwise SEASON_TO_YEAR; otherwise approximate seasonNum+1930-1
  let year;
  if (game?.startTime) {
    year = new Date(game.startTime).getFullYear();
  } else if (d.seasonName) {
    const m = String(d.seasonName).match(/(\d{4})/);
    if (m) year = parseInt(m[1], 10);
  } else if (d.title) {
    const m = String(d.title).match(/(\d{4})/);
    if (m) year = parseInt(m[1], 10);
  }
  if (!year) year = SEASON_TO_YEAR[d.seasonNum] || (d.seasonNum ? d.seasonNum + 1930 - 1 : null);

  const hostMatch = d.title ? d.title.match(/^(.+?)\s+\d{4}$/) : null;
  // host fallback: if seasonName contains a known pattern (e.g. "Canada/Mexico/USA")
  // extract that as the host country.
  let host = hostMatch ? hostMatch[1].trim() : (d.host || null);
  if (!host && d.seasonName) {
    const m = String(d.seasonName).match(/\d{4}\s+(.+)$/);
    if (m) host = m[1].trim();
  }

  // Champion lookup: el shape del upstream 365scores viene en DOS formas:
  //  - Mundial: { champion: { name, competitorId }, runnerUp: {...} }
  //  - Ligas con tabla: { entityId, values: [...] } sin nombre del campeón
  // Si falta `champion.name` pero tenemos `entityId`, lo resolvemos desde el teamMap.
  let champion = null;
  if (d.champion && d.champion.name) {
    champion = {
      name: d.champion.name,
      competitorId: d.champion.competitorId,
      badgeUrl: d.champion.competitorId
        ? images.getTeamBadgeUrl(d.champion.competitorId, teamMap[String(d.champion.competitorId)]?.imageVersion)
        : null,
    };
  } else if (d.entityId && teamMap[String(d.entityId)]) {
    const t = teamMap[String(d.entityId)];
    champion = {
      name: t.name,
      competitorId: d.entityId,
      badgeUrl: images.getTeamBadgeUrl(d.entityId, t.imageVersion),
    };
  } else if (participants[0]) {
    champion = {
      name: participants[0].name,
      competitorId: participants[0].competitorId,
      badgeUrl: participants[0].badgeUrl,
    };
  }

  return {
    seasonNum: d.seasonNum,
    year,
    title: d.title || d.seasonName || null,
    secondaryTitle: d.secondaryTitle || null,
    host,
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
    champion,
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
  MAJOR_STAT_IDS,
  GROUP_NAMES,
  SEASON_TO_YEAR,
  enrichTeam,
  enrichAthlete,
  enrichGame,
  enrichTrend,
  enrichTip,
  formatTime,
  extractLineup,
  buildLineups,
  enrichTransferWithTeam,
  buildMatchupId,
  transformStandingRow,
  parseHistoryDoc,
};
