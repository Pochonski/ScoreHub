// Handler de estadísticas - Mundial 2026
const footballApi = require('../services/footballApi');

/**
 * Obtiene estadísticas de un partido específico
 */
async function getStatsPartido(matchId) {
  try {
    return await footballApi.getMatchStats(matchId);
  } catch (error) {
    return null;
  }
}

/**
 * Traduce el tipo de estadística al nombre en la API
 */
function getStatKey(tipo) {
  const keys = {
    'corners': 'Corners',
    'yellow_cards': 'Yellow cards',
    'red_cards': 'Red cards',
    'shots': 'Total shots',
    'shots_on_target': 'Shots on target',
    'possession': 'Ball possession',
    'goals': 'Goals'
  };
  return keys[tipo] || null;
}

/**
 * Estadísticas de un equipo
 */
async function getEstadisticas(parsed) {
  const { tipo, equipo } = parsed;

  if (!equipo) {
    return '⚠️ Indica el equipo. Ej: "¿Cuántos córners hizo Brasil?"';
  }

  try {
    let teamId = equipo.id;
    let teamName = equipo.nombre;

    if (!teamId || equipo.buscarDinamico) {
      const team = await footballApi.buscarEquipoDinamico(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}".`;
      }
      teamId = team.id;
      teamName = team.name;
    }

    const matches = await footballApi.getTeamMatches(teamId, 5);

    if (!matches || matches.length === 0) {
      return `⚠️ No encontré partidos de ${teamName}.`;
    }

    let msg = `📊 *ESTADÍSTICAS DE ${teamName.toUpperCase()}*\n\n`;
    msg += `📈 Últimos ${matches.length} partidos\n\n`;

    // Si hay tipo específico (corners, tarjetas, etc), obtener stats de cada partido
    if (tipo) {
      const statKey = getStatKey(tipo);
      msg += `📋 *Resultados y ${tipo}:*\n`;

      for (const m of matches.slice(0, 5)) {
        const score = m.homeScore !== null ? `${m.homeScore} - ${m.awayScore}` : 'vs';
        msg += `\n⚽ ${m.homeTeam} ${score} ${m.awayTeam}`;

        if (statKey && m.homeScore !== null) {
          const stats = await getStatsPartido(m.id);
          if (stats && stats[statKey]) {
            const { home, away } = stats[statKey];
            msg += `\n   ${statKey}: ${home} - ${away}`;
          }
        }
      }
    } else {
      // Sin tipo específico: solo resultados
      msg += `📋 *Resultados:*\n`;
      matches.forEach(m => {
        const score = m.homeScore !== null ? `${m.homeScore} - ${m.awayScore}` : 'vs';
        msg += `• ${m.homeTeam} ${score} ${m.awayTeam}\n`;
      });
    }

    return msg;
  } catch (error) {
    console.error('Error getEstadisticas:', error);
    return `⚠️ No pude obtener estadísticas de ${equipo.nombre}.`;
  }
}

module.exports = { getEstadisticas };