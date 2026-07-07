// Formateadores de respuesta para WhatsApp

/**
 * Formatea una lista de partidos del día
 */
function formatPartidosHoy(partidos) {
  if (!partidos || partidos.length === 0) {
    return '⚽ No hay partidos programados para hoy.';
  }

  let mensaje = '⚽ *PARTIDOS DE HOY*\n\n';

  // Agrupar por liga
  const porLiga = {};
  partidos.forEach(p => {
    const liga = p.league?.name || 'Desconocido';
    if (!porLiga[liga]) porLiga[liga] = [];
    porLiga[liga].push(p);
  });

  for (const [liga, matches] of Object.entries(porLiga)) {
    mensaje += `🏆 *${liga}*\n`;
    matches.forEach(m => {
      const hora = m.time || '--:--';
      const estado = formatEstado(m.status);
      const score = m.score || '';
      mensaje += `${m.homeTeam} vs ${m.awayTeam} | ${hora}\n`;
      if (score) mensaje += `[${estado} ${score}]\n`;
      mensaje += '\n';
    });
  }

  return mensaje.trim();
}

/**
 * Formatea el estado de un partido
 */
function formatEstado(status) {
  const estados = {
    'LIVE': '🔴 Live',
    'HT': '⏸️ HT',
    'FT': '✅ FT',
    'NS': '⏳ Soon',
    'PST': '⏸️ PST',
    'CANC': '❌ CAN',
    'POSTP': '⏸️ PP'
  };
  return estados[status] || status || '';
}

/**
 * Formatea un resultado de partido
 */
function formatResultado(partido) {
  const estado = formatEstado(partido.status);
  return `⚽ *RESULTADO*\n\n` +
    `🏆 ${partido.league}\n` +
    `${partido.homeTeam} ${partido.score || 'vs'} ${partido.awayTeam}\n` +
    `📅 ${partido.date}\n` +
    `[${estado}]`;
}

/**
 * Formatea estadísticas de un partido
 */
function formatEstadisticas(stats) {
  if (!stats) return '📊 No hay estadísticas disponibles.';

  let msg = '📊 *ESTADÍSTICAS*\n\n';
  msg += `⚽ Goles: ${stats.homeScore || 0} - ${stats.awayScore || 0}\n`;
  msg += `🥅 Tiros al arco: ${stats.homeShotsOnTarget || 0} - ${stats.awayShotsOnTarget || 0}\n`;
  msg += `🎯 Tiros totales: ${stats.homeShots || 0} - ${stats.awayShots || 0}\n`;
  msg += `📐 Córners: ${stats.homeCorners || 0} - ${stats.awayCorners || 0}\n`;
  msg += `🟨 Tarjetas amarillas: ${stats.homeYellowCards || 0} - ${stats.awayYellowCards || 0}\n`;
  msg += `🟥 Tarjetas rojas: ${stats.homeRedCards || 0} - ${stats.awayRedCards || 0}\n`;
  msg += `⏱️ Posesión: ${stats.homePossession || 0}% - ${stats.awayPossession || 0}%\n`;

  return msg;
}

/**
 * Formatea información de un equipo
 */
function formatEquipo(info) {
  let msg = `👥 *${info.name}*\n\n`;
  msg += `🏆 ${info.league || 'Sin liga activa'}\n`;
  msg += `📍 Posición: ${info.position || '-'}\n`;
  msg += `📊 Puntos: ${info.points || 0}\n`;
  msg += `🎯 PJ: ${info.played || 0} | PG: ${info.win || 0} | PE: ${info.draw || 0} | PP: ${info.lose || 0}\n`;
  msg += `⚽ GF: ${info.goalsFor || 0} | GC: ${info.goalsAgainst || 0}\n`;

  return msg;
}

/**
 * Formatea una tabla de posiciones con alineación clara y emojis de posición
 */
function formatTabla(standings, liga) {
  if (!standings || standings.length === 0) {
    return `📊 No hay información de tabla para ${liga}.`;
  }

  const data = standings.slice(0, 12);

  // Calcular anchos dinámicos para el nombre
  const maxNameLen = Math.min(18, Math.max(...data.map(t => (t.team?.name || t.name || '?').length)));

  let msg = `📊 *TABLA — ${liga.toUpperCase()}*\n\n`;

  data.forEach((team, i) => {
    const rank = team.rank || (i + 1);
    const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
    const nombre = (team.team?.name || team.name || '?').substring(0, maxNameLen);
    const pj = team.played || team.matchesPlayed || 0;
    const v  = team.wins || team.win || 0;
    const e  = team.draws || team.draw || 0;
    const d  = team.losses || team.lose || 0;
    const gf = team.goalsFor || team.scoresFor || 0;
    const gc = team.goalsAgainst || team.scoresAgainst || 0;
    const gd = (team.goalDiff != null ? team.goalDiff : (gf - gc));
    const gdStr = gd > 0 ? `+${gd}` : `${gd}`;
    const pts = team.points || 0;

    msg += `${emoji} *${rank}.* ${nombre}\n`;
    msg += `     PJ ${pj}  |  V${v} E${e} D${d}  |  Goles ${gf}-${gc} (${gdStr})  |  *${pts} pts*\n`;
  });

  msg += `\n_Leyenda: V=victorias · E=empates · D=derrotas · GD=goles diferencia_`;
  return msg;
}

/**
 * Formatea una tabla de grupo (Mundial 2026) en un bloque de código pre-formateado
 * con columnas alineadas para mejor legibilidad en Telegram.
 *
 * Estructura de columnas: [#][EQUIPO][PTS][PJ][V-E-D][GOLES][DG]
 *
 * @param {Array} rows - Lista de equipos con { rank, name, played, wins, draws, losses, goalsFor, goalsAgainst, goalDiff, points }
 * @param {string} grupo - Letra del grupo (A-L), opcional
 * @returns {string} Mensaje formateado con bloque de código
 */
function formatGroupTable(rows, grupo) {
  if (!rows || rows.length === 0) {
    return `📋 No hay datos${grupo ? ` para el grupo ${grupo}` : ''}.`;
  }

  // Truncar nombres largos para mantener alineación
  const NAME_MAX = 22;
  const normalized = rows.map(r => ({
    rank: r.rank,
    name: (r.name || '?').substring(0, NAME_MAX),
    played: r.played || 0,
    wins: r.wins || 0,
    draws: r.draws || 0,
    losses: r.losses || 0,
    goalsFor: r.goalsFor || 0,
    goalsAgainst: r.goalsAgainst || 0,
    goalDiff: r.goalDiff != null ? r.goalDiff : ((r.goalsFor || 0) - (r.goalsAgainst || 0)),
    points: r.points || 0,
  }));

  // Anchos máximos dinámicos para cada columna
  const wRank = Math.max(1, ...normalized.map(r => String(r.rank).length));
  const wName = Math.max(2, ...normalized.map(r => r.name.length));
  const wPts = Math.max(3, ...normalized.map(r => String(r.points).length));
  const wPj  = Math.max(2, ...normalized.map(r => String(r.played).length));
  const wGf  = Math.max(2, ...normalized.map(r => String(r.goalsFor).length));
  const wGa  = Math.max(2, ...normalized.map(r => String(r.goalsAgainst).length));

  const padR = (s, w) => String(s).padEnd(w, ' ');
  const padL = (s, w) => String(s).padStart(w, ' ');

  // Helper para formato de diferencia de goles: +4, -1, 0
  const fmtGD = (gd) => gd > 0 ? `+${gd}` : `${gd}`;

  // Helper para W-D-L
  const fmtWDL = (w, d, l) => `${w}-${d}-${l}`;

  const header = [
    padR('#', wRank),
    padR('EQUIPO', wName),
    padL('PTS', wPts),
    padL('PJ', wPj),
    padR('V-E-D', 5),
    padR('GOLES', 7),
    padL('DG', 4)
  ].join('  ');

  const lines = normalized.map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const wdl = fmtWDL(r.wins, r.draws, r.losses);
    const goles = `${r.goalsFor}-${r.goalsAgainst}`;
    return [
      padR(String(r.rank), wRank),
      padR(r.name, wName),
      padL(String(r.points), wPts),
      padL(String(r.played), wPj),
      padR(wdl, 5),
      padR(goles, 7),
      padL(fmtGD(r.goalDiff), 4)
    ].join('  ');
  }).map((l, i) => `${i === 0 ? medal : '  '}${l}`);

  let msg = '';
  if (grupo) msg += `📋 *GRUPO ${grupo.toUpperCase()} — MUNDIAL 2026*\n\n`;
  msg += '```\n';
  msg += header + '\n';
  lines.forEach(l => { msg += l + '\n'; });
  msg += '```';
  return msg;
}

/**
 * Formatea análisis para apuestas
 */
function formatAnalisis(home, away, stats) {
  const goalsHome = isNaN(home.goalsPerMatch) ? '-' : home.goalsPerMatch;
  const goalsAway = isNaN(away.goalsPerMatch) ? '-' : away.goalsPerMatch;
  const cornersHome = home.cornersPerMatch === 'N/A' ? 'N/A' : (isNaN(home.cornersPerMatch) ? '-' : home.cornersPerMatch);
  const cornersAway = away.cornersPerMatch === 'N/A' ? 'N/A' : (isNaN(away.cornersPerMatch) ? '-' : away.cornersPerMatch);

  let msg = `📊 *ANÁLISIS DE APUESTAS*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚽ ${home.name}  vs  ${away.name}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🏠 *LOCAL:* ${home.name}\n`;
  msg += `   📈 Forma: ${home.form || '-'}\n`;
  msg += `   ⚽ Goles/match: ${goalsHome}\n`;
  msg += `   📐 Corners/match: ${cornersHome}\n`;
  msg += `   🏟️ Local: ${home.homeRecord || '-'}\n\n`;

  msg += `✈️ *VISITANTE:* ${away.name}\n`;
  msg += `   📈 Forma: ${away.form || '-'}\n`;
  msg += `   ⚽ Goles/match: ${goalsAway}\n`;
  msg += `   📐 Corners/match: ${cornersAway}\n`;
  msg += `   🏟️ Visitante: ${away.awayRecord || '-'}\n\n`;

  if (stats) {
    msg += `📈 *TENDENCIAS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (stats.btts) msg += `🔵 BTTS Sí: ${stats.btts}%\n`;
    if (stats.over25) msg += `⚽ Over 2.5: ${stats.over25}%\n`;
    if (stats.cornersOver) msg += `📐 Corners +9.5: ${stats.cornersOver}%\n`;
  }

  return msg;
}

/**
 * Formatea resumen de partido
 */
function formatResumen(resumen) {
  let msg = `📋 *RESUMEN*\n\n`;
  msg += `${resumen.homeTeam} vs ${resumen.awayTeam}\n\n`;
  msg += `${resumen.homeTeam}:\n`;
  msg += `• ${resumen.homeSummary}\n\n`;
  msg += `${resumen.awayTeam}:\n`;
  msg += `• ${resumen.awaySummary}\n\n`;
  msg += `📊 *H2H:* ${resumen.h2h || 'Sin antecedentes'}\n`;

  return msg;
}

/**
 * Formatea confirmación de seguimiento
 */
function formatEquipoSeguido(equipo) {
  return `✅ Ahora sigues a *${equipo}*. Usa "mis equipos" para ver tu lista.`;
}

/**
 * Formatea lista de equipos seguidos
 */
function formatMisEquipos(equipos) {
  if (!equipos || equipos.length === 0) {
    return '📋 No sigues ningún equipo. Usa "Seguir [equipo]" para agregar.';
  }

  let msg = '📋 *EQUIPOS QUE SIGUES*\n\n';
  equipos.forEach((e, i) => {
    msg += `${i + 1}. ${e.nombre_equipo}\n`;
  });

  return msg;
}

/**
 * Formatea una línea de partido con marcador y resultado del equipo.
 * Retorna además flags útiles para detectar eliminación/penales.
 *
 * @param {Object} match - { homeTeam, homeTeamId, homeScore, awayTeam, awayTeamId, awayScore, date, status, tournament }
 * @param {string} teamId - ID del equipo para calcular marcador relativo
 * @returns {Object} { line, isKnockout, lostOnPenalties, teamLost, marker, score }
 */
function formatMatchLine(match, teamId) {
  const isHome = match.homeTeamId === teamId || match.homeTeamId == String(teamId);
  const teamScore = isHome ? match.homeScore : match.awayScore;
  const oppScore  = isHome ? match.awayScore  : match.homeScore;
  const teamName  = isHome ? match.homeTeam   : match.awayTeam;
  const oppName   = isHome ? match.awayTeam   : match.homeTeam;

  const hasScore = teamScore != null && teamScore >= 0 && oppScore != null && oppScore >= 0;
  const marker = !hasScore ? '🕐'
               : teamScore > oppScore ? '✅'
               : teamScore < oppScore ? '❌'
               : '🟰';
  const score = hasScore ? `${teamScore}-${oppScore}` : 'vs';

  const date = new Date(match.date).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const tournament = match.tournament || match.leagueName || 'Competición';
  const penalties = /pen/i.test(match.status || '') ? ' (p.)' : '';

  return {
    line: `${date} | 🏆 ${tournament} | ${teamName} ${marker} ${score}${penalties} ${oppName}`,
    isKnockout: /round|quarter|semi|final/i.test(tournament) && !/group/i.test(tournament),
    lostOnPenalties: /pen/i.test(match.status || ''),
    teamLost: hasScore && teamScore < oppScore,
    teamWon: hasScore && teamScore > oppScore,
    marker,
    score,
    raw: match
  };
}

/**
 * Detecta si el equipo fue eliminado en su partido más reciente.
 * Criterio: el último partido es en fase eliminatoria Y el equipo perdió (en tiempo regular o penales).
 *
 * @param {Array} matches - Lista de partidos (orden: más reciente primero)
 * @param {string} teamId
 * @returns {Object|null} { phase, opponent, onPenalties, score, date } o null si no aplica
 */
function detectElimination(matches, teamId) {
  if (!matches || matches.length === 0) return null;
  const last = matches[0];
  const formatted = formatMatchLine(last, teamId);
  if (formatted.isKnockout && (formatted.teamLost || formatted.lostOnPenalties)) {
    return {
      phase: last.tournament,
      opponent: last.homeTeamId == teamId ? last.awayTeam : last.homeTeam,
      onPenalties: formatted.lostOnPenalties,
      score: last.homeScore != null ? `${last.homeScore}-${last.awayScore}` : 'vs',
      date: last.date
    };
  }
  return null;
}

module.exports = {
  formatPartidosHoy,
  formatEstado,
  formatResultado,
  formatEstadisticas,
  formatEquipo,
  formatTabla,
  formatAnalisis,
  formatResumen,
  formatEquipoSeguido,
  formatMisEquipos,
  formatMatchLine,
  detectElimination,
  getCurrentStreak
};

/**
 * Detecta la racha actual de un equipo (W o L) y la devuelve con emoji.
 * Por ejemplo "W4" (4 victorias seguidas) o "L2" (2 derrotas seguidas).
 * Sin racha → null.
 * @param {Array} matches - partidos ya jugados y ordenados DESC
 * @param {string} teamId
 * @returns {{streakType: 'W'|'L', count: number}|null}
 */
function getCurrentStreak(matches, teamId) {
  if (!matches || matches.length === 0) return null;
  let streakType = null;
  let count = 0;
  for (const m of matches) {
    const isHome = m.homeTeamId == teamId;
    const t = isHome ? m.homeScore : m.awayScore;
    const o = isHome ? m.awayScore : m.homeScore;
    if (t == null || o == null) break;
    const result = t > o ? 'W' : t < o ? 'L' : 'D';
    if (streakType === null) {
      if (result === 'D') continue;
      streakType = result;
      count = 1;
    } else if (result === streakType) {
      count++;
    } else if (result === 'D') {
      continue;
    } else {
      break;
    }
  }
  return streakType ? { streakType, count } : null;
}