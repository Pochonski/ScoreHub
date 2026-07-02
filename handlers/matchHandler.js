// Handler de partidos y resultados - Mundial 2026
const footballApi = require('../services/footballApi');
const { LIGAS } = require('../utils/constants');
const { formatMatchLine, detectElimination } = require('../utils/formatters');

/**
 * Partidos de hoy
 */
async function getPartidosHoy(parsed = {}) {
  try {
    const matches = await footballApi.getTodayMatches();

    if (!matches || matches.length === 0) {
      return `⚽ *PARTIDOS DE HOY*\n\n` +
        `📋 *Comandos disponibles:*\n\n` +
        `• "Cómo quedó [equipo]" - Último resultado\n` +
        `• "[equipo] vs [equipo]" - Enfrentamiento\n` +
        `• "Dame info de [equipo]" - Información del equipo\n` +
        `• "Analiza [equipo] vs [equipo]" - Análisis detallado\n` +
        `• "Estadísticas de [equipo]" - Estadísticas\n` +
        `• "Tabla del Mundial" - Clasificación\n` +
        `• "Seguir [equipo]" - Agregar a favoritos\n` +
        `• "Mis equipos" - Ver favoritos\n\n` +
        `Ejemplo: "Cómo quedó Brasil?"`;
    }

    // Agrupar por torneo
    const porTorneo = {};
    matches.forEach(m => {
      const torneo = m.tournament || 'Otro';
      if (!porTorneo[torneo]) porTorneo[torneo] = [];
      porTorneo[torneo].push(m);
    });

    let msg = `⚽ *PARTIDOS DE HOY*\n\n`;
    for (const [torneo, partidos] of Object.entries(porTorneo)) {
      msg += `🏆 ${torneo}\n`;
      partidos.forEach(m => {
        const score = m.homeScore !== null ? `${m.homeScore} - ${m.awayScore}` : 'vs';
        const time = m.date ? new Date(m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
        msg += `${m.homeTeam} ${score} ${m.awayTeam}${time ? ` | ${time}` : ''}\n`;
      });
      msg += '\n';
    }

    return msg.trim();
  } catch (error) {
    console.error('Error getPartidosHoy:', error);
    return `⚽ *MUNDIAL 2026*\n\n` +
      `📋 *Comandos disponibles:*\n\n` +
      `• "Cómo quedó [equipo]" - Último resultado\n` +
      `• "[equipo] vs [equipo]" - Enfrentamiento\n` +
      `• "Dame info de [equipo]" - Información del equipo\n` +
      `• "Analiza [equipo] vs [equipo]" - Análisis detallado\n` +
      `• "Estadísticas de [equipo]" - Estadísticas\n` +
      `• "Tabla del Mundial" - Clasificación\n` +
      `• "Seguir [equipo]" - Agregar a favoritos\n` +
      `• "Mis equipos" - Ver favoritos\n\n` +
      `Ejemplo: "Cómo quedó Brasil?"`;
  }
}

/**
 * Partidos de una fecha específica
 * Acepta: string YYYYMMDD o null/empty
 */
async function getPartidosFecha(tipoFecha) {
  if (!tipoFecha || tipoFecha === 'null' || tipoFecha === 'undefined') {
    return '📅 *PARTIDOS POR FECHA*\n\n' +
      'Para ver partidos de una fecha específica, indícala:\n' +
      '• "Partidos del 5 de julio"\n' +
      '• "Qué juega el viernes"\n' +
      '• "Partidos del 20260705"\n\n' +
      '💡 Para *últimos resultados* de un equipo, usa:\n' +
      '   "Cómo quedó [equipo]" o "Últimos partidos de [equipo]"';
  }

  // Formato YYYYMMDD -> YYYY-MM-DD para el usuario
  let fechaFmt = tipoFecha;
  if (/^\d{8}$/.test(tipoFecha)) {
    fechaFmt = `${tipoFecha.slice(0,4)}-${tipoFecha.slice(4,6)}-${tipoFecha.slice(6,8)}`;
  }

  try {
    const matches = await footballApi.getMatchesByDate(tipoFecha);
    if (!matches || matches.length === 0) {
      return `📅 No encontré partidos para el ${fechaFmt}.`;
    }

    let msg = `📅 *PARTIDOS - ${fechaFmt}*\n\n`;
    matches.slice(0, 20).forEach(m => {
      const score = m.homeScore != null ? `${m.homeScore} - ${m.awayScore}` : m.time || '';
      msg += `⚽ ${m.homeTeam} ${score} ${m.awayTeam}\n`;
    });
    return msg;
  } catch (error) {
    console.error('Error getPartidosFecha:', error.message);
    return `⚠️ No pude obtener partidos para ${fechaFmt}.`;
  }
}

/**
 * Último resultado de un equipo
 * Acepta: string con el nombre del equipo, u objeto {id, nombre, buscarDinamico}
 */
async function getResultadoEquipo(equipo) {
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
      return '⚠️ No especificaste el equipo. Ejemplo: "¿Cómo quedó Brasil?"';
    }

    if (!teamId || (equipo && equipo.buscarDinamico)) {
      const team = await footballApi.buscarEquipoDinamico(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}". Verifica el nombre e intenta de nuevo.`;
      }
      teamId = team.id;
      teamName = team.name;
    }

    const matches = await footballApi.getTeamMatches(teamId, 5);

    if (!matches || matches.length === 0) {
      return `⚠️ No encontré partidos recientes de ${teamName}.`;
    }

    let msg = `⚽ *ÚLTIMOS PARTIDOS - ${teamName.toUpperCase()}*\n\n`;

    // Mostrar los últimos 3 partidos con formato detallado
    matches.slice(0, 3).forEach(m => {
      msg += formatMatchLine(m, teamId).line + '\n';
    });

    // Footer con estado del equipo
    const elimination = detectElimination(matches, teamId);
    if (elimination) {
      const penMsg = elimination.onPenalties ? ' (perdió por penales)' : '';
      msg += `\n📊 *Estado:* ❌ Eliminado en *${elimination.phase}*${penMsg}`;
    } else {
      const last = matches[0];
      const lastFmt = formatMatchLine(last, teamId);
      const oppName = last.homeTeamId == teamId ? last.awayTeam : last.homeTeam;
      const status = lastFmt.teamWon ? `✅ Ganó a ${oppName}`
                    : lastFmt.teamLost ? `❌ Perdió vs ${oppName}`
                    : lastFmt.marker === '🕐' ? `🕐 Partido pendiente vs ${oppName}`
                    : `🟰 Empató vs ${oppName}`;
      msg += `\n📊 *Estado:* Sigue en competencia (último: ${status})`;
    }

    return msg;
  } catch (error) {
    console.error('Error getResultadoEquipo:', error);
    return `⚠️ No pude obtener el resultado.`;
  }
}

/**
 * Resultado de un enfrentamiento específico
 */
async function getResultadoVS(home, away) {
  try {
    let homeTeam, awayTeam;

    if (typeof home === 'string' || (home && !home.id)) {
      const homeName = typeof home === 'string' ? home : home.nombre;
      homeTeam = await footballApi.buscarEquipoDinamico(homeName);
    } else {
      homeTeam = { id: home.id, name: home.nombre };
    }

    if (typeof away === 'string' || (away && !away.id)) {
      const awayName = typeof away === 'string' ? away : away.nombre;
      awayTeam = await footballApi.buscarEquipoDinamico(awayName);
    } else {
      awayTeam = { id: away.id, name: away.nombre };
    }

    if (!homeTeam) {
      return `⚠️ No encontré al equipo "${typeof home === 'string' ? home : (home && home.nombre) || ''}"`;
    }
    if (!awayTeam) {
      return `⚠️ No encontré al equipo "${typeof away === 'string' ? away : (away && away.nombre) || ''}"`;
    }

    const homeMatches = await footballApi.getTeamMatches(homeTeam.id, 15);

    const h2h = homeMatches.find(m =>
      (m.homeTeam?.toLowerCase().includes(awayTeam.name.toLowerCase()) ||
       m.awayTeam?.toLowerCase().includes(awayTeam.name.toLowerCase()))
    );

    if (h2h) {
      const score = h2h.homeScore !== null ? `${h2h.homeScore} - ${h2h.awayScore}` : 'vs';
      const date = new Date(h2h.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      return `⚽ *ENFRENTAMIENTO*\n\n${h2h.homeTeam} ${score} ${h2h.awayTeam}\n📅 ${date}\n🏆 ${h2h.tournament}`;
    }

    return `⚠️ No encontré enfrentamientos recientes entre ${homeTeam.name} y ${awayTeam.name}.\n\n` +
      `Pueden no haberse enfrentado en este Mundial.`;
  } catch (error) {
    console.error('Error getResultadoVS:', error);
    return `⚠️ No pude obtener el resultado.`;
  }
}

module.exports = {
  getPartidosHoy,
  getPartidosFecha,
  getResultadoEquipo,
  getResultadoVS
};