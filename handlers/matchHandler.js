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

    const rawMatches = await footballApi.getTeamMatches(teamId, 20);

    if (!rawMatches || rawMatches.length === 0) {
      return `⚠️ No encontré partidos recientes de ${teamName}.`;
    }

    // Filtrar a partidos YA JUGADOS (con marcador real) y ordenar por fecha DESC
    const matches = rawMatches
      .filter(m => m.homeScore != null && m.awayScore != null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (matches.length === 0) {
      return `⚠️ No encontré partidos jugados recientemente de ${teamName}.`;
    }

    let msg = `⚽ *ÚLTIMOS PARTIDOS - ${teamName.toUpperCase()}*\n\n`;

    // Mostrar los últimos 3 partidos con formato detallado
    matches.slice(0, 3).forEach(m => {
      msg += formatMatchLine(m, teamId).line + '\n';
    });

    // Footer con estado del equipo (basado en partidos JUGADOS)
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
 * Resultado de un enfrentamiento específico entre dos equipos
 * Busca en los partidos de AMBOS equipos para mayor覆盖率
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

    // Buscar en paralelo los partidos de ambos equipos (mayor cobertura)
    const [homeMatches, awayMatches] = await Promise.all([
      footballApi.getTeamMatches(homeTeam.id, 30),
      footballApi.getTeamMatches(awayTeam.id, 30)
    ]);

    const homeLower = homeTeam.name.toLowerCase();
    const awayLower = awayTeam.name.toLowerCase();

    // Función para detectar si un partido es entre estos dos equipos
    const isH2H = (m) => {
      const ht = (m.homeTeam || '').toLowerCase();
      const at = (m.awayTeam || '').toLowerCase();
      return (ht.includes(homeLower) && at.includes(awayLower)) ||
             (ht.includes(awayLower) && at.includes(homeLower));
    };

    // Combinar y deduplicar partidos jugados, ordenados por fecha DESC
    const allCandidates = [...(homeMatches || []), ...(awayMatches || [])]
      .filter(m => m.homeScore != null && m.awayScore != null && isH2H(m));

    const seen = new Set();
    const unique = [];
    allCandidates.sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const m of unique.length < 5 ? allCandidates : allCandidates) {
      if (!seen.has(m.id) && unique.length < 5) {
        seen.add(m.id);
        unique.push(m);
      }
    }

    if (unique.length === 0) {
      return `⚠️ No encontré enfrentamientos recientes entre *${homeTeam.name}* y *${awayTeam.name}*.\n\n` +
        `💡 Puede que no se hayan enfrentado recientemente, o los datos no estén disponibles en mi fuente.`;
    }

    let msg = `⚽ *ENFRENTAMIENTOS — ${homeTeam.name.toUpperCase()} VS ${awayTeam.name.toUpperCase()}*\n\n`;
    msg += `📅 *Últimos ${unique.length} enfrentamientos:*\n`;
    unique.forEach(m => {
      msg += formatMatchLine(m, homeTeam.id).line + '\n';
    });
    return msg;
  } catch (error) {
    console.error('Error getResultadoVS:', error);
    return `⚠️ No pude obtener el resultado del enfrentamiento.`;
  }
}

module.exports = {
  getPartidosHoy,
  getPartidosFecha,
  getResultadoEquipo,
  getResultadoVS
};