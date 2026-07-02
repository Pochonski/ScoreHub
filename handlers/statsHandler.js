// Handler de estadísticas - Mundial 2026
const footballApi = require('../services/footballApi');
const { getRecentForm } = require('../utils/teamContext');
const { formatMatchLine } = require('../utils/formatters');

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
  const tipoLower = (tipo || '').toLowerCase();
  const keys = {
    'corners': 'Corners',
    'corner': 'Corners',
    'tiros de esquina': 'Corners',
    'yellow_cards': 'Yellow cards',
    'amarillas': 'Yellow cards',
    'tarjetas amarillas': 'Yellow cards',
    'red_cards': 'Red cards',
    'rojas': 'Red cards',
    'tarjetas rojas': 'Red cards',
    'shots': 'Total shots',
    'tiros': 'Total shots',
    'shots_on_target': 'Shots on target',
    'tiros al arco': 'Shots on target',
    'possession': 'Ball possession',
    'posesion': 'Ball possession',
    'posesión': 'Ball possession',
    'goals': 'Goals',
    'goles': 'Goals'
  };
  return keys[tipoLower] || null;
}

/**
 * Estadísticas de un equipo
 * @param {Object} parsed - { tipo, equipo }
 */
async function getEstadisticas(parsed) {
  const { tipo, equipo } = parsed;

  if (!equipo) {
    return '⚠️ Indica el equipo. Ej: "Estadísticas de Brasil"';
  }

  try {
    let teamId;
    let teamName;
    if (typeof equipo === 'string') {
      teamName = equipo;
    } else if (equipo && typeof equipo === 'object') {
      teamId = equipo.id;
      teamName = equipo.nombre;
    }

    if (!teamName || teamName.trim() === '') {
      return '⚠️ Indica el equipo. Ej: "Estadísticas de Brasil"';
    }

    if (!teamId || (equipo && equipo.buscarDinamico)) {
      const team = await footballApi.buscarEquipoDinamico(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}".`;
      }
      teamId = team.id;
      teamName = team.name;
    }

    // Buscar más partidos para tener margen tras filtrar
    const rawMatches = await footballApi.getTeamMatches(teamId, 20);

    if (!rawMatches || rawMatches.length === 0) {
      return `⚠️ No encontré partidos de ${teamName}.`;
    }

    // Filtrar a partidos JUGADOS y ordenar DESC
    const played = rawMatches
      .filter(m => m.homeScore != null && m.awayScore != null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (played.length === 0) {
      return `⚠️ No encontré partidos jugados de ${teamName}.`;
    }

    const form = getRecentForm(rawMatches, teamId, 5);

    let msg = `📊 *ESTADÍSTICAS DE ${teamName.toUpperCase()}*\n\n`;

    if (form.played > 0) {
      const pct = Math.round((form.wins * 100) / form.played);
      msg += `📈 *Forma reciente:* ${form.line}  —  ${form.wins}G ${form.draws}E ${form.losses}D (${pct}% victorias)\n\n`;
    }

    // Si hay tipo específico (corners, tarjetas, etc), obtener stats de cada partido
    if (tipo) {
      const statKey = getStatKey(tipo);
      const tipoFriendly = (tipo || '').toLowerCase();

      msg += `📋 *${statKey || tipoFriendly} por partido:*\n\n`;

      const recent = played.slice(0, 5);
      for (const m of recent) {
        msg += formatMatchLine(m, teamId).line + '\n';

        if (statKey && m.id) {
          const stats = await getStatsPartido(m.id);
          if (stats && stats[statKey]) {
            const { home, away } = stats[statKey];
            const isHome = m.homeTeamId == teamId;
            const teamStat = isHome ? home : away;
            const oppStat = isHome ? away : home;
            msg += `      → ${statKey}: *${teamStat}* vs ${oppStat}\n`;
          }
        }
      }
    } else {
      // Sin tipo específico: solo resultados
      msg += `📋 *Últimos ${Math.min(5, played.length)} resultados:*\n`;
      played.slice(0, 5).forEach(m => {
        msg += formatMatchLine(m, teamId).line + '\n';
      });
    }

    return msg;
  } catch (error) {
    console.error('Error getEstadisticas:', error);
    const teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    return `⚠️ No pude obtener estadísticas de ${teamName}.`;
  }
}

module.exports = { getEstadisticas };