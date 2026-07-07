// Handler de estadísticas - Mundial 2026
const cache = require('../services/mundialCache');
const { getRecentForm } = require('../utils/teamContext');
const { formatMatchLine } = require('../utils/formatters');

const STAT_KEYS = {
  corners: 'Corners',
  'tiros de esquina': 'Corners',
  amarillas: 'Yellow cards',
  'tarjetas amarillas': 'Yellow cards',
  rojas: 'Red cards',
  'tarjetas rojas': 'Red cards',
  tiros: 'Total shots',
  'tiros al arco': 'Shots on target',
  posesion: 'Ball possession',
  goles: 'Goals',
};

const NO_DATA = (name) => `⚠️ No encontré datos de ${name}.`;

async function getEstadisticas(parsed) {
  const { tipo, equipo } = parsed;
  if (!equipo) {
    return '⚠️ Indica el equipo. Ej: "Estadísticas de Brasil"';
  }
  try {
    let teamId, teamName;
    if (typeof equipo === 'string') {
      teamName = equipo;
    } else if (equipo && typeof equipo === 'object') {
      teamId = equipo.id;
      teamName = equipo.nombre;
    }
    if (!teamName || !teamName.trim()) {
      return '⚠️ Indica el equipo. Ej: "Estadísticas de Brasil"';
    }
    if (!teamId) {
      const team = await cache.getTeamByName(teamName);
      if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
      teamId = team.id;
      teamName = team.name;
    }
    const rawMatches = await cache.getRecentWorldCupMatchesByTeam(teamId);
    if (!rawMatches || rawMatches.length === 0) {
      return NO_DATA(teamName);
    }
    const played = rawMatches
      .filter((m) => m.homeCompetitor?.score != null && m.homeCompetitor?.score >= 0 && m.awayCompetitor?.score != null && m.awayCompetitor?.score >= 0)
      .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date));
    if (played.length === 0) return NO_DATA(teamName);
    const form = getRecentForm(rawMatches, teamId, 5);
    let msg = `📊 *ESTADÍSTICAS DE ${teamName.toUpperCase()}*\n\n`;
    if (form.played > 0) {
      const pct = Math.round((form.wins * 100) / form.played);
      msg += `📈 *Forma reciente:* ${form.line}  —  ${form.wins}G ${form.draws}E ${form.losses}D (${pct}% victorias)\n\n`;
    }
    if (tipo && STAT_KEYS[tipo.toLowerCase()]) {
      const statKey = STAT_KEYS[tipo.toLowerCase()];
      msg += `📋 *${statKey} por partido:*\n\n`;
      const recent = played.slice(0, 5);
      for (const m of recent) {
        msg += formatMatchLine(m, teamId).line + '\n';
        if (m.id) {
          const stats = await cache.getMatchStats(m.id);
          if (stats && stats.length > 0) {
            const st = stats.find((s) => s.name === statKey);
            if (st) {
              const isHome = m.homeCompetitor?.id === teamId;
              const teamStat = isHome ? st.home : st.away;
              const oppStat = isHome ? st.away : st.home;
              msg += `      → ${statKey}: *${teamStat}* vs ${oppStat}\n`;
            }
          }
        }
      }
    } else {
      msg += `📋 *Últimos ${Math.min(5, played.length)} resultados:*\n`;
      played.slice(0, 5).forEach((m) => { msg += formatMatchLine(m, teamId).line + '\n'; });
    }
    return msg;
  } catch (error) {
    console.error('Error getEstadisticas:', error);
    const teamName = typeof equipo === 'object' ? equipo.nombre : equipo;
    return `⚠️ No pude obtener estadísticas de ${teamName}.`;
  }
}

async function getGoleadores(limit = 10) {
  try {
    const data = await cache.getTournamentTop();
    const stats = data || {};
    const topScorers = stats.athletesStats || stats.athletesTopScorers || stats.topScorers || [];
    if (!topScorers.length) {
      return '⚠️ No hay datos de goleadores disponibles.';
    }
    let msg = `⚽ *TOP GOLEADORES - MUNDIAL 2026*\n\n`;
    topScorers.slice(0, limit).forEach((row, idx) => {
      const rank = row.idx || (idx + 1);
      const name = row.name || row.player?.name || '?';
      const team = row.team?.name || row.teamName || '';
      const goals = row.goals || row.value || 0;
      const matches = row.matches || row.matchesplayed || 0;
      msg += `${rank}. ⚽ *${name}* (${team}) — *${goals}* goles${matches ? ` en ${matches} partidos` : ''}\n`;
    });
    return msg;
  } catch (error) {
    console.error('Error getGoleadores:', error);
    return '⚠️ No pude obtener los goleadores.';
  }
}

module.exports = { getEstadisticas, getGoleadores };