// Handler de partidos y resultados
const cache = require('../services/mundialCache');
const { getCompetitionName } = require('../services/competitionName');
const mundialista365 = require('./mundialista365Handler');
const { formatMatchLine, detectElimination } = require('../utils/formatters');
const logger = require('../utils/logger');
const { PRIMARY_COMPETITION_ID: COMPETITION_ID } = require('../services/config');

function dateStr(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).replace(/-/g, '');
}

function fmtDate(ddmmyyyy) {
  if (!ddmmyyyy || ddmmyyyy.length !== 8) return ddmmyyyy;
  return `${ddmmyyyy.slice(0, 4)}-${ddmmyyyy.slice(4, 6)}-${ddmmyyyy.slice(6, 8)}`;
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  if (/^\d{2}:\d{2}/.test(isoStr)) return isoStr;
  try {
    const d = new Date(isoStr);
    if (!isNaN(d)) return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica', hour12: false });
  } catch (_) { /* Date.parse can throw on invalid input */ }
  return isoStr;
}

function getGroupFromMatch(m) {
  const stageName = (m.stageName || m.competitionDisplayName || '').toLowerCase();
  const g = stageName.match(/group\s+([a-l])/);
  if (g) return g[1].toUpperCase();
  if (stageName.includes('octavos')) return 'Octavos';
  if (stageName.includes('cuartos')) return 'Cuartos';
  if (stageName.includes('semis')) return 'Semis';
  if (stageName.includes('final')) return 'Final';
  return '?';
}

async function getPartidosHoy(parsed = {}) {
  try {
    const today = dateStr();
    const games = await cache.getWorldCupGames({ date: today });
    if (!games || games.length === 0) {
      const compName = await getCompetitionName(COMPETITION_ID);
      return buildNoMatchesMessage(compName);
    }
    const porGrupo = {};
    games.forEach((m) => {
      const g = getGroupFromMatch(m);
      if (!porGrupo[g]) porGrupo[g] = [];
      porGrupo[g].push(m);
    });
    const grupos = Object.keys(porGrupo).sort();
    const compName = await getCompetitionName(COMPETITION_ID);
    let msg = `⚽ *${compName} — PARTIDOS DE HOY*\n\n`;
    msg += `📅 *${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Costa_Rica' })}*\n\n`;
    for (const grupo of grupos) {
      const partidos = porGrupo[grupo];
      msg += `📋 *${grupo}*  (${partidos.length} partido${partidos.length === 1 ? '' : 's'})\n`;
      partidos.forEach((m) => {
        const hs = m.homeCompetitor?.score;
        const as = m.awayCompetitor?.score;
        const hasScore = hs != null && hs >= 0 && as != null && as >= 0;
        const home = m.homeCompetitor?.name || '?';
        const away = m.awayCompetitor?.name || '?';
        if (hasScore) {
          msg += `⚽ ${home} ${hs} - ${as} ${away}\n`;
        } else {
          const time = formatTime(m.startTime);
          const suffix = time ? ` _(${time})_` : '';
          msg += `⚽ ${home} vs ${away}${suffix}\n`;
        }
      });
      msg += '\n';
    }
    msg += `💡 _Tip: "Tabla del grupo X" para ver la clasificación._`;
    return msg.trim();
  } catch (error) {
    logger.error({ err: error }, 'Error getPartidosHoy');
    const compNameFb = await getCompetitionName(COMPETITION_ID);
    return buildNoMatchesMessage(compNameFb);
  }
}

function buildNoMatchesMessage(compName = 'TORNEO') {
  return `⚽ *${compName} — PARTIDOS DE HOY*\n\n` +
    `🟢 No hay partidos programados para hoy.\n\n` +
    `📋 *Otros comandos útiles:*\n` +
    `• "Tabla del grupo A" — Ver clasificación\n` +
    `• "Cómo quedó [equipo]" — Último resultado\n` +
    `• "Próximos partidos del Mundial" — Lo que viene`;
}

function dateCR(offsetDays = 0) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const [y, m, d] = hoy.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

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
  let fecha;
  if (tipoFecha === 'today') {
    fecha = dateCR();
  } else if (tipoFecha === 'tomorrow') {
    fecha = dateCR(1);
  } else if (tipoFecha === 'day_after') {
    fecha = dateCR(2);
  } else if (tipoFecha === 'yesterday') {
    fecha = dateCR(-1);
  } else if (tipoFecha === 'day_before') {
    fecha = dateCR(-2);
  } else if (/^\d{8}$/.test(tipoFecha)) {
    fecha = tipoFecha;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(tipoFecha)) {
    fecha = tipoFecha.replace(/-/g, '');
  } else {
    try {
      const d = new Date(tipoFecha);
      if (!isNaN(d)) {
        fecha = d.toISOString().slice(0, 10).replace(/-/g, '');
      }
    } catch (e) { logger.warn({ err: e.message, input: tipoFecha }, 'parseFecha: date parse failed'); }
  }
  if (!/^\d{8}$/.test(fecha)) {
    return `⚠️ No pude interpretar la fecha "${tipoFecha}". Usa formato YYYYMMDD o "5 de julio".`;
  }
  try {
    const games = await cache.getWorldCupGames({ date: fecha });
    if (!games || games.length === 0) {
      return `📅 No encontré partidos para ${fmtDate(fecha)}.`;
    }
    let msg = `📅 *PARTIDOS - ${fmtDate(fecha)}*\n\n`;
    games.slice(0, 25).forEach((m) => {
      const hs = m.homeCompetitor?.score;
      const as = m.awayCompetitor?.score;
      const hasScore = hs != null && hs >= 0 && as != null && as >= 0;
      const home = m.homeCompetitor?.name || '?';
      const away = m.awayCompetitor?.name || '?';
      if (hasScore) {
        msg += `⚽ ${home} ${hs} - ${as} ${away}`;
      } else {
        const time = m.startTime ? ` (${formatTime(m.startTime)})` : '';
        msg += `⚽ ${home} vs ${away}${time}`;
      }
      if (m.stageName && m.stageName !== 'Fase de grupos') msg += ` _(${m.stageName})_`;
      msg += '\n';
    });
    return msg.trim();
  } catch (error) {
    logger.error({ err: error }, 'Error getPartidosFecha');
    return `⚠️ No pude obtener partidos para ${fmtDate(fecha)}.`;
  }
}

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
    if (!teamName || !teamName.trim()) {
      return '⚠️ No especificaste el equipo. Ejemplo: "¿Cómo quedó Brasil?"';
    }
    if (!teamId) {
      const team = await cache.getTeamByName(teamName);
      if (!team) {
        return `⚠️ No encontré al equipo "${teamName}". Verifica el nombre e intenta de nuevo.`;
      }
      teamId = team.id;
      teamName = team.name;
    }
    const rawMatches = await cache.getRecentWorldCupMatchesByTeam(teamId);
    if (!rawMatches || rawMatches.length === 0) {
      return `⚠️ No encontré partidos recientes de ${teamName} en el Mundial.`;
    }
    const matches = rawMatches
      .filter((m) => m.homeCompetitor?.score != null && m.homeCompetitor?.score >= 0 && m.awayCompetitor?.score != null && m.awayCompetitor?.score >= 0)
      .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date));
    if (matches.length === 0) {
      const upcoming = rawMatches
        .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && (m.awayCompetitor?.score == null || m.awayCompetitor?.score < 0))
        .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || a.date));
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const oppId = next.homeCompetitor?.id === teamId ? next.awayCompetitor?.id : next.homeCompetitor?.id;
        const oppName = next.homeCompetitor?.id === teamId ? next.awayCompetitor?.name : next.homeCompetitor?.name;
        if (oppId && oppName) {
          const tips = await getUpcomingMatchTips({ id: teamId, name: teamName }, { id: oppId, name: oppName });
          if (tips) return tips;
        }
      }
      return `⚠️ No encontré partidos jugados de ${teamName}.`;
    }
    let msg = `⚽ *ÚLTIMOS PARTIDOS - ${teamName.toUpperCase()}*\n\n`;
    matches.slice(0, 3).forEach((m) => {
      msg += formatMatchLine(m, teamId).line + '\n';
    });
    const elimination = detectElimination(matches, teamId);
    if (elimination) {
      const penMsg = elimination.onPenalties ? ' (perdió por penales)' : '';
      msg += `\n📊 *Estado:* ❌ Eliminado en *${elimination.phase}*${penMsg}`;
    } else {
      const last = matches[0];
      const lastFmt = formatMatchLine(last, teamId);
      const oppId = last.homeCompetitor?.id === teamId ? last.awayCompetitor?.id : last.homeCompetitor?.id;
      const oppName = last.homeCompetitor?.id === teamId ? last.awayCompetitor?.name : last.homeCompetitor?.name;
      const status = lastFmt.teamWon ? `✅ Ganó a ${oppName}`
        : lastFmt.teamLost ? `❌ Perdió vs ${oppName}`
        : `🟰 Empató vs ${oppName}`;
      msg += `\n📊 *Estado:* Sigue en competencia (último: ${status})`;
    }
    return msg;
  } catch (error) {
    logger.error({ err: error }, 'Error getResultadoEquipo');
    return '⚠️ No pude obtener el resultado.';
  }
}

async function getProximosEquipo(equipo, limit = 5) {
  try {
    let teamId, teamName;
    if (typeof equipo === 'string') {
      teamName = equipo;
    } else if (equipo && typeof equipo === 'object') {
      teamId = equipo.id;
      teamName = equipo.nombre;
    }
    if (!teamName || !teamName.trim()) {
      return '⚠️ No especificaste el equipo. Ej: `/proximos Brasil`';
    }
    if (!teamId) {
      const team = await cache.getTeamByName(teamName);
      if (!team) return `⚠️ No encontré al equipo "${teamName}".`;
      teamId = team.id;
      teamName = team.name;
    }
    const now = Date.now();
    const all = await cache.getRecentWorldCupMatchesByTeam(teamId);
    const upcoming = (all || [])
      .filter((m) => new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
      .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && (m.awayCompetitor?.score == null || m.awayCompetitor?.score < 0))
      .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
      .slice(0, limit);
    if (upcoming.length === 0) {
      return `📅 *PRÓXIMOS PARTIDOS - ${teamName.toUpperCase()}*\n\n🟢 Sin partidos próximos en el horizonte.`;
    }
    let msg = `📅 *PRÓXIMOS PARTIDOS - ${teamName.toUpperCase()}*\n\n`;
    upcoming.forEach((m) => {
      const dt = new Date(m.startTime || m.date);
      const date = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      const isHome = m.homeCompetitor?.id === teamId;
      msg += `• ${date} · ${isHome ? '🟢 LOCAL' : '✈️ VISITANTE'}\n`;
      msg += `  ${m.homeCompetitor?.name || '?'} vs ${m.awayCompetitor?.name || '?'}\n`;
      if (m.stageName && m.stageName !== 'Fase de grupos') msg += `  🏆 ${m.stageName}\n`;
      msg += '\n';
    });
    return msg.trim();
  } catch (error) {
    logger.error({ err: error }, 'Error getProximosEquipo');
    return '⚠️ No pude obtener próximos partidos.';
  }
}

/**
 * Si hay un partido próximo entre homeTeam y awayTeam (sin score),
 * devuelve el tip + tendencias. Si no, null.
 */
async function getUpcomingMatchTips(homeTeam, awayTeam) {
  try {
    const game = await cache.findGameByCompetitors(homeTeam.id, awayTeam.id);
    if (!game) return null;
    const hs = game.homeCompetitor?.score;
    const as = game.awayCompetitor?.score;
    if (hs != null && hs >= 0 && as != null && as >= 0) return null;

    const date = new Date(game.startTime || game.date || 0);
    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let msg = `⚽ *PRÓXIMO PARTIDO*\n`;
    msg += `📅 ${dateStr}\n`;
    msg += `🏟 ${homeTeam.name} vs ${awayTeam.name}`;
    if (game.stageName && game.stageName !== 'Fase de grupos') msg += ` · ${game.stageName}`;
    msg += '\n\n';

    const [tip, trends] = await Promise.all([
      mundialista365.getTipPartido(homeTeam.name, awayTeam.name).catch(() => null),
      mundialista365.getTendenciasByTeams(homeTeam.name, awayTeam.name, 5).catch(() => null),
    ]);
    if (tip) {
      msg += `${tip}\n\n`;
    }
    if (trends) {
      msg += `${trends}`;
    }
    if (!tip && !trends) return null;
    return msg.trim();
  } catch (e) {
    logger.error({ err: e }, 'Error getUpcomingMatchTips');
    return null;
  }
}

async function getResultadoVS(home, away) {
  try {
    let homeTeam, awayTeam;
    if (typeof home === 'string' || (home && !home.id)) {
      const h = await cache.getTeamByName(typeof home === 'string' ? home : home.nombre);
      if (h) homeTeam = { id: h.id, name: h.name };
    } else homeTeam = { id: home.id, name: home.nombre };
    if (typeof away === 'string' || (away && !away.id)) {
      const a = await cache.getTeamByName(typeof away === 'string' ? away : away.nombre);
      if (a) awayTeam = { id: a.id, name: a.name };
    } else awayTeam = { id: away.id, name: away.nombre };
    if (!homeTeam) return `⚠️ No encontré al equipo "${typeof home === 'string' ? home : (home && home.nombre) || ''}"`;
    if (!awayTeam) return `⚠️ No encontré al equipo "${typeof away === 'string' ? away : (away && away.nombre) || ''}"`;

    const matchupId = `${homeTeam.id}-${awayTeam.id}-${cache.COMPETITION_ID}`;
    const h2h = await cache.getMatchH2H(null, matchupId).catch(() => null);

    if (h2h && h2h.h2hGames && h2h.h2hGames.length > 0) {
      const seen = new Set();
      const unique = [];
      const played = h2h.h2hGames
        .filter((m) => m.homeCompetitor?.score != null && m.homeCompetitor?.score >= 0 && m.awayCompetitor?.score != null && m.awayCompetitor?.score >= 0)
        .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date));
      for (const m of played) {
        if (!seen.has(m.id) && unique.length < 5) {
          seen.add(m.id);
          unique.push(m);
        }
      }
      if (unique.length === 0) {
        const tips = await getUpcomingMatchTips(homeTeam, awayTeam);
        if (tips) return tips;
        return `⚠️ No encontré enfrentamientos recientes entre *${homeTeam.name}* y *${awayTeam.name}*.`;
      }
      let msg = `⚽ *ENFRENTAMIENTOS — ${homeTeam.name.toUpperCase()} VS ${awayTeam.name.toUpperCase()}*\n\n`;
      msg += `📅 *Últimos ${unique.length} enfrentamientos:*\n`;
      unique.forEach((m) => { msg += formatMatchLine(m, homeTeam.id).line + '\n'; });
      return msg;
    }

    const tips = await getUpcomingMatchTips(homeTeam, awayTeam);
    if (tips) return tips;
    return `⚠️ No encontré enfrentamientos directos entre *${homeTeam.name}* y *${awayTeam.name}*.\n\n` +
      `💡 Puede que no se hayan enfrentado en el Mundial, o los datos no estén disponibles.`;
  } catch (error) {
    logger.error({ err: error }, 'Error getResultadoVS');
    return '⚠️ No pude obtener el resultado del enfrentamiento.';
  }
}

module.exports = {
  getPartidosHoy,
  getPartidosFecha,
  getResultadoEquipo,
  getResultadoVS,
  getProximosEquipo,
};