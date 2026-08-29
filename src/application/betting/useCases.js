/**
 * src/application/betting/useCases.js — Use-cases de análisis de apuestas (Fase 8).
 *
 * Reemplazan los métodos de `handlers/bettingHandler.js`:
 *   - analizarEnfrentamiento → createAnalizarEnfrentamiento
 *   - analizarEquipo         → createAnalizarEquipo
 *
 * Sólo leen del `cache` (mundialCache). La función privada `calculateTeamStats`
 * se mantiene acá como helper puro — depende sólo del shape de los partidos
 * que devuelve el cache, no de una API externa.
 */

const { formatAnalisis } = require('../../../utils/formatters');

function calculateTeamStats(matches, teamName) {
  if (!matches || matches.length === 0) {
    return { form: '-', goalsPerMatch: '0', cornersPerMatch: 'N/A', record: '-', homeRecord: '-', awayRecord: '-' };
  }

  let wins = 0, draws = 0, losses = 0;
  let homeWins = 0, homeDraws = 0, homeLosses = 0;
  let awayWins = 0, awayDraws = 0, awayLosses = 0;
  let goals = 0;

  matches.forEach((m) => {
    if (m.homeScore === null || m.homeScore === undefined) return;
    if (m.awayScore === null || m.awayScore === undefined) return;

    const isHome = m.homeTeam?.toLowerCase().includes(teamName.toLowerCase());
    const teamGoals = isHome ? m.homeScore : m.awayScore;
    const opponentGoals = isHome ? m.awayScore : m.homeScore;

    if (typeof teamGoals !== 'number' || typeof opponentGoals !== 'number') return;

    goals += teamGoals;

    if (teamGoals > opponentGoals) {
      wins++;
      if (isHome) homeWins++; else awayWins++;
    } else if (teamGoals === opponentGoals) {
      draws++;
      if (isHome) homeDraws++; else awayDraws++;
    } else {
      losses++;
      if (isHome) homeLosses++; else awayLosses++;
    }
  });

  const total = wins + draws + losses;
  if (total === 0) {
    return {
      form: '-',
      goalsPerMatch: Number.NaN,
      cornersPerMatch: 'N/A',
      record: '-',
      homeRecord: '-',
      awayRecord: '-',
    };
  }

  return {
    form: `${wins}V ${draws}E ${losses}D`,
    goalsPerMatch: parseFloat((goals / total).toFixed(1)),
    cornersPerMatch: 'N/A',
    record: `${wins}V ${draws}E ${losses}D`,
    homeRecord: `${homeWins}V ${homeDraws}E ${homeLosses}D`,
    awayRecord: `${awayWins}V ${awayDraws}E ${awayLosses}D`,
  };
}

async function resolveTeam(input, cache) {
  if (typeof input === 'string' || (input && !input.id)) {
    const name = typeof input === 'string' ? input : input.nombre;
    const found = await cache.getTeamByName(name);
    return found ? { id: found.id, name: found.name } : null;
  }
  return { id: input.id, name: input.nombre };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /analisis <eq1> vs <eq2>                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function createAnalizarEnfrentamiento({ cache, logger = console }) {
  if (!cache) throw new Error('createAnalizarEnfrentamiento: cache required');

  return async function analizarEnfrentamiento(home, away) {
    try {
      const homeTeam = await resolveTeam(home, cache);
      const awayTeam = await resolveTeam(away, cache);
      if (!homeTeam) return `⚠️ No encontré al equipo "${typeof home === 'string' ? home : (home && home.nombre) || ''}"`;
      if (!awayTeam) return `⚠️ No encontré al equipo "${typeof away === 'string' ? away : (away && away.nombre) || ''}"`;

      const homeMatches = await cache.getRecentWorldCupMatchesByTeam(homeTeam.id);
      const awayMatches = await cache.getRecentWorldCupMatchesByTeam(awayTeam.id);

      const homeStats = calculateTeamStats(homeMatches, homeTeam.name);
      const awayStats = calculateTeamStats(awayMatches, awayTeam.name);

      const h2h = homeMatches.find((m) =>
        m.homeTeam?.toLowerCase().includes(awayTeam.name.toLowerCase()) ||
        m.awayTeam?.toLowerCase().includes(awayTeam.name.toLowerCase())
      );

      const analisis = {
        home: {
          name: homeTeam.name,
          form: homeStats.form,
          goalsPerMatch: homeStats.goalsPerMatch,
          cornersPerMatch: homeStats.cornersPerMatch,
          homeRecord: homeStats.record,
        },
        away: {
          name: awayTeam.name,
          form: awayStats.form,
          goalsPerMatch: awayStats.goalsPerMatch,
          cornersPerMatch: awayStats.cornersPerMatch,
          awayRecord: awayStats.record,
        },
        stats: {
          btts: h2h ? (h2h.homeScore > 0 && h2h.awayScore > 0 ? '70' : '40') : 'N/D',
          over25: h2h ? (h2h.homeScore + h2h.awayScore > 2 ? '65' : '45') : 'N/D',
          cornersOver: '55-65',
        },
      };

      return formatAnalisis(analisis.home, analisis.away, analisis.stats);
    } catch (error) {
      logger.error?.({ err: error }, 'Error analizarEnfrentamiento');
      return `⚠️ No pude analizar ${home.nombre || home} vs ${away.nombre || away}.`;
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /analisis <equipo>                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function createAnalizarEquipo({ cache, logger = console }) {
  if (!cache) throw new Error('createAnalizarEquipo: cache required');

  return async function analizarEquipo(equipo) {
    try {
      let teamId = typeof equipo === 'object' ? equipo.id : null;
      let teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
      const buscarDinamico = typeof equipo === 'object' ? equipo.buscarDinamico : true;

      if (!teamId || buscarDinamico) {
        const team = await cache.getTeamByName(teamName);
        if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
        teamId = team.id;
        teamName = team.name;
      }

      const matches = await cache.getRecentWorldCupMatchesByTeam(teamId);
      const stats = calculateTeamStats(matches, teamName);

      const goals = isNaN(stats.goalsPerMatch) ? '-' : stats.goalsPerMatch;
      const corners = stats.cornersPerMatch === 'N/A' ? 'N/A' : (isNaN(stats.cornersPerMatch) ? '-' : stats.cornersPerMatch);

      let msg = `📈 *ANÁLISIS: ${teamName}*\n\n`;
      msg += '📊 *Rendimiento general*\n';
      msg += `• Últimos ${matches.length}: ${stats.form}\n`;
      msg += `• Goles/partido: ${goals}\n`;
      msg += `• Promedio corners: ${corners}\n\n`;
      msg += `🏠 *Local:* ${stats.homeRecord}\n`;
      msg += `✈️ *Visitante:* ${stats.awayRecord}\n`;

      return msg;
    } catch (error) {
      logger.error?.({ err: error }, 'Error analizarEquipo');
      return `⚠️ No pude analizar ${typeof equipo === 'object' ? equipo.nombre : equipo}.`;
    }
  };
}

module.exports = {
  createAnalizarEnfrentamiento,
  createAnalizarEquipo,
};
