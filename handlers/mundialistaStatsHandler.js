require('dotenv').config();
const cosmos = require('../database/cosmos');
const matchSearch = require('../services/matchSearch');
const { getAthletePhotoUrl } = require('../services/images');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);

const SEASON_TO_YEAR = {
  1: 1930, 2: 1934, 3: 1938,
  6: 1950, 7: 1954, 8: 1958, 9: 1962, 10: 1966,
  11: 1970, 12: 1974, 13: 1978, 14: 1982, 15: 1986,
  16: 1990, 17: 1994, 18: 1998, 19: 2002, 20: 2006,
  21: 2010, 22: 2014, 23: 2018, 24: 2022,
};

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Costa_Rica' });
  } catch (_) {
    return iso.split('T')[0] || iso;
  }
}

function pad(s, w) {
  s = String(s ?? '');
  if (s.length > w) return s.slice(0, w - 1) + '…';
  return s + ' '.repeat(Math.max(0, w - s.length));
}

function cleanupTitle(s) {
  return (s || '').replace(/<[^>]+>/g, '').trim();
}

// =================================================================
// /noticias [equipo]
// =================================================================

async function getNoticias({ equipo = null, limit = 10 } = {}) {
  try {
    if (equipo) {
      const games = await matchSearch.findGamesByCompetitorName(equipo, { limit: 50 });
      if (!games || games.length === 0) {
        return `📰 No encontré partidos de *${equipo}* en el Mundial.\n\n💡 Probá \`/noticias\` para las últimas del Mundial.`;
      }

      const gameIds = games.map(g => Number(g.id));
      const allNews = await cosmos.queryAll('news',
        { query: 'SELECT c.title, c.publishDate, c.gameId, c.url FROM c WHERE c.scope = @s AND c.competitionId = @c', parameters: [{ name: '@s', value: 'game' }, { name: '@c', value: MUNDIAL_ID }] });

      let filtered = allNews.filter(n => n.gameId && gameIds.includes(Number(n.gameId)));
      if (filtered.length === 0) {
        const compNews = await cosmos.queryAll('news',
          { query: 'SELECT c.title, c.publishDate, c.url FROM c WHERE c.scope = @s AND c.competitionId = @c ORDER BY c.publishDate DESC OFFSET 0 LIMIT @lim', parameters: [{ name: '@s', value: 'comp' }, { name: '@c', value: MUNDIAL_ID }, { name: '@lim', value: limit }] });
        const eq = equipo.toLowerCase();
        const matchNews = compNews.filter(n => n.title && n.title.toLowerCase().includes(eq));
        if (matchNews.length === 0) {
          return `📰 No hay noticias específicas de *${equipo}* todavía.\n💡 Probá \`/noticias\` para ver las últimas del Mundial.`;
        }
        filtered = matchNews;
      }

      filtered.sort((a, b) => new Date(b.publishDate || 0) - new Date(a.publishDate || 0));
      filtered = filtered.slice(0, limit);

      let msg = `📰 *NOTICIAS — ${equipo.toUpperCase()}*\n\n`;
      filtered.forEach((n, i) => {
        msg += `${i + 1}. *${cleanupTitle(n.title)}*\n`;
        msg += `   📅 ${fmtDate(n.publishDate)}\n`;
        if (n.url) msg += `   🔗 ${n.url}\n`;
        msg += '\n';
      });
      return msg.trim();
    }

    const news = await cosmos.queryAll('news',
      { query: 'SELECT c.title, c.publishDate, c.url FROM c WHERE c.scope = @s AND c.competitionId = @c ORDER BY c.publishDate DESC OFFSET 0 LIMIT @lim', parameters: [{ name: '@s', value: 'comp' }, { name: '@c', value: MUNDIAL_ID }, { name: '@lim', value: limit }] });

    if (!news || news.length === 0) {
      return '📰 No hay noticias del Mundial todavía.';
    }

    let msg = `📰 *ÚLTIMAS NOTICIAS — MUNDIAL 2026*\n\n`;
    news.forEach((n, i) => {
      msg += `${i + 1}. *${cleanupTitle(n.title)}*\n`;
      msg += `   📅 ${fmtDate(n.publishDate)}\n`;
      if (n.url) msg += `   🔗 ${n.url}\n`;
      msg += '\n';
    });
    return msg.trim();
  } catch (e) {
    return `⚠️ No pude obtener noticias: ${e.message}`;
  }
}

// =================================================================
// /equipoideal
// =================================================================

async function getEquipoIdeal() {
  try {
    const docs = await cosmos.queryAll('highlights',
      { query: 'SELECT TOP 1 * FROM c WHERE c.kind = @k ORDER BY c._ts DESC', parameters: [{ name: '@k', value: 'team_of_week' }] });
    if (!docs || docs.length === 0) {
      return `🌟 No hay equipo de la semana disponible todavía.\n\n💡 Corré \`node scripts/cosmos-bootstrap.js\` para generar el Team of the Week.`;
    }

    const tow = docs[0].teamOfWeek;
    if (!tow || !tow.lineup || !Array.isArray(tow.lineup.members) || tow.lineup.members.length === 0) {
      return `🌟 El documento de Team of the Week está incompleto. Probá re-correr el bootstrap.`;
    }

    const f = tow.lineup.formation || '4-4-2';
    const members = tow.lineup.members;

    let msg = `🌟 *EQUIPO IDEAL — MUNDIAL 2026*\n`;
    msg += `📋 Formación: ${f}\n\n`;

    const byPos = {};
    const posOrder = ['Portero', 'Defensa', 'Mediocampista', 'Delantero'];

    members.forEach(m => {
      const pos = m.position?.name || 'Otros';
      m._posSort = posOrder.indexOf(pos) >= 0 ? posOrder.indexOf(pos) : 99;
      if (!byPos[pos]) byPos[pos] = [];
      byPos[pos].push(m);
    });

    Object.keys(byPos)
      .sort((a, b) => (byPos[a][0]._posSort || 99) - (byPos[b][0]._posSort || 99))
      .forEach(pos => {
        msg += `_${pos}:_\n`;
        byPos[pos].forEach(m => {
          const name = m.shortName || m.name || '?';
          const team = m.teamName || m.competitorName || '';
          const rating = m.rating != null ? ` ⭐${m.rating}` : '';
          msg += `   • ${name}${team ? ` (${team})` : ''}${rating}\n`;
        });
        msg += '\n';
      });

    return msg.trim();
  } catch (e) {
    return `⚠️ No pude obtener el equipo ideal: ${e.message}`;
  }
}

// =================================================================
// /bracket [grupos|eliminatorias|todo]
// =================================================================

async function getBracket(scope = 'eliminatorias') {
  try {
    const doc = await cosmos.getById('brackets', String(MUNDIAL_ID), MUNDIAL_ID);
    if (!doc || !Array.isArray(doc.brackets) || doc.brackets.length === 0) {
      return `🏆 *LLAVES DEL MUNDIAL*\n\n` +
        `La estructura de brackets no está disponible todavía.\n\n` +
        `💡 Probá:\n` +
        `• \`/mundial\` para ver la tabla general\n` +
        `• \`/grupo A\` (A-L) para tabla de un grupo\n` +
        `• Corré \`npm run cosmos:bootstrap\` para generar los brackets.`;
    }

    const bracket = doc.brackets[0];
    const stages = bracket.stages || [];
    if (stages.length === 0) {
      return `🏆 El doc de brackets no tiene stages. Re-corré el bootstrap.`;
    }

    let msg = `🏆 *LLAVES DEL MUNDIAL 2026*\n\n`;

    if (scope === 'grupos') {
      msg += formatGroupStage(stages[0]);
    } else if (scope === 'todo') {
      msg += formatGroupStage(stages[0]);
      msg += '\n' + formatKnockoutStages(stages.slice(1));
    } else {
      msg += formatKnockoutStages(stages.slice(1));
    }

    return msg.trim();
  } catch (e) {
    return `⚠️ No pude leer los brackets: ${e.message}`;
  }
}

function formatGroupStage(stage) {
  if (!stage || !Array.isArray(stage.groups)) return '';

  let out = `📋 *FASE DE GRUPOS*\n\n`;
  stage.groups.forEach(g => {
    const name = g.name || 'Grupo ?';
    const competitors = (g.competitors || []).map(c => c.name || c.shortName || '?');
    out += `  *${name}*: ${competitors.join(' · ')}\n`;
  });
  return out;
}

function formatKnockoutStages(stages) {
  if (!stages || stages.length === 0) return '';

  let out = `🗡️ *FASE ELIMINATORIA*\n\n`;
  stages.forEach(s => {
    const name = s.name || 'Ronda';
    const groups = s.groups || [];
    out += `━━ ${name} ━━\n`;

    if (groups.length === 0) {
      out += `   _sin datos_\n\n`;
      return;
    }

    groups.forEach(g => {
      const participants = (g.participants || []).map(p => p.name || p.shortName || '?');
      const games = (g.games || []).map(gm => {
        const h = gm.homeCompetitor?.name || gm.homeCompetitor?.shortName || gm.participant1?.name || '?';
        const a = gm.awayCompetitor?.name || gm.awayCompetitor?.shortName || gm.participant2?.name || '?';
        const hs = gm.homeCompetitor?.score != null && gm.homeCompetitor?.score >= 0 ? gm.homeCompetitor.score : (gm.participant1Score ?? '');
        const as = gm.awayCompetitor?.score != null && gm.awayCompetitor?.score >= 0 ? gm.awayCompetitor.score : (gm.participant2Score ?? '');
        const score = hs !== '' || as !== '' ? ` ${hs}-${as}` : '';
        return `${h}${score} vs${score} ${a}`;
      });

      if (participants.length >= 2 && games.length === 0) {
        out += `   ${participants[0]} vs ${participants[1]}\n`;
      } else {
        games.forEach(gm => {
          out += `   ${gm}\n`;
        });
      }
    });
    out += '\n';
  });
  return out;
}

// =================================================================
// /historial [año|equipo]
// =================================================================

async function getHistorial(arg = null) {
  try {
    if (arg && /^\d{4}$/.test(String(arg))) {
      return getHistorialByYear(Number(arg));
    }
    if (arg && String(arg).trim()) {
      return getHistorialByTeam(String(arg).trim());
    }

    const docs = await cosmos.queryAll('competition_history',
      { query: 'SELECT c.id, c.seasonNum, c.group FROM c WHERE c.competitionId = @c ORDER BY c.seasonNum DESC', parameters: [{ name: '@c', value: MUNDIAL_ID }] });

    if (!docs || docs.length === 0) {
      return `🏆 No hay historial del Mundial disponible. Corré \`node scripts/cosmos-bootstrap.js\`.`;
    }

    let msg = `🏆 *HISTORIAL — MUNDIAL 1930–2022*\n\n`;
    docs.forEach(d => {
      const year = SEASON_TO_YEAR[d.seasonNum] || `Ed. ${d.seasonNum}`;
      const participants = d.group?.participants || [];
      const champion = participants[0]?.name || '?';
      const runnerUp = participants[1]?.name || '?';
      const venue = d.group?.games?.[0]?.venue?.name || '';
      const emoji = d.seasonNum === SEASON_TO_YEAR[24] ? '🥇 ' : '';
      msg += `${emoji}*${year}*: ${champion} 🇨🇵 ${runnerUp || ''}`;
      if (venue) msg += ` _(${venue})_`;
      msg += '\n';
    });

    msg += `\n📖 Para ver detalle: \`/historial 2022\` o \`/historial brasil\``;
    return msg.trim();
  } catch (e) {
    return `⚠️ No pude obtener el historial: ${e.message}`;
  }
}

async function getHistorialByYear(year) {
  const entries = Object.entries(SEASON_TO_YEAR);
  const match = entries.find(([_, y]) => y === year);
  if (!match) {
    const available = Object.values(SEASON_TO_YEAR).join(', ');
    return `🏆 No hay datos para ${year}. Ediciones disponibles: ${available}.`;
  }

  const seasonNum = Number(match[0]);
  const doc = await cosmos.getById('competition_history', `${MUNDIAL_ID}-se${seasonNum}`, MUNDIAL_ID);
  if (!doc) {
    return `🏆 No encontré datos para ${year}.`;
  }

  const g = doc.group;
  if (!g) return `🏆 El doc de ${year} no tiene datos de final.`;

  const participants = g.participants || [];
  const games = g.games || [];
  const p1 = participants[0]?.name || '?';
  const p2 = participants[1]?.name || '?';

  let msg = `🏆 *${year} — ${p1} vs ${p2}*\n\n`;
  msg += `🏟️ Sede: ${games[0]?.venue?.name || '?'}\n`;
  msg += `🥇 Campeón: *${p1}*\n`;
  msg += `🥈 Subcampeón: *${p2}*\n`;

  return msg.trim();
}

async function getHistorialByTeam(team) {
  const docs = await cosmos.queryAll('competition_history',
    { query: 'SELECT c.seasonNum, c.group FROM c WHERE c.competitionId = @c ORDER BY c.seasonNum ASC', parameters: [{ name: '@c', value: MUNDIAL_ID }] });

  if (!docs || docs.length === 0) {
    return `🏆 No hay historial disponible.`;
  }

  const teamLower = team.toLowerCase();
  const relevant = docs.filter(d => {
    const parts = (d.group?.participants || []).map(p => (p.name || '').toLowerCase());
    return parts.some(p => p.includes(teamLower) || teamLower.includes(p));
  });

  if (relevant.length === 0) {
    const allTeams = new Set();
    docs.forEach(d => (d.group?.participants || []).forEach(p => allTeams.add(p.name)));
    const list = [...allTeams].sort().join(', ');
    return `🏆 *${team}* no aparece en el historial del Mundial.\n\nEquipos disponibles: ${list}`;
  }

  let msg = `🏆 *${team.toUpperCase()} EN EL MUNDIAL*\n\n`;
  relevant.forEach(d => {
    const year = SEASON_TO_YEAR[d.seasonNum] || `Ed. ${d.seasonNum}`;
    const participants = d.group?.participants || [];
    const p1 = participants[0]?.name || '?';
    const p2 = participants[1]?.name || '?';
    const isChampion = p1.toLowerCase().includes(teamLower);
    const isRunnerUp = p2.toLowerCase().includes(teamLower);
    const role = isChampion ? '🥇 Campeón' : (isRunnerUp ? '🥈 Subcampeón' : '🎗️ Finalista');
    msg += `*${year}*: ${role} (${p1} vs ${p2})\n`;
  });

  return msg.trim();
}

// =================================================================
// /goleadores
// =================================================================

async function getGoleadores(limit = 10) {
  try {
    const doc = await cosmos.getById('tournament_stats', `${MUNDIAL_ID}-se25-athletesStats`, MUNDIAL_ID);
    if (!doc || !doc.payload) {
      return { text: `⚽ No hay ranking de goleadores disponible.\n\n💡 Corré \`node scripts/cosmos-bootstrap.js\` para generar las stats.` };
    }

    const payload = Array.isArray(doc.payload) ? doc.payload : Object.values(doc.payload);
    const goalsCat = payload.find(p => p.name === 'Goles' || p.id === 1);
    const rows = goalsCat?.rows || [];
    if (!rows.length) {
      return { text: `⚽ El doc de tournament_stats no tiene datos de goleadores.` };
    }

    const parsed = rows.map(r => ({
      name: r.entity?.name || r.entity?.shortName || '?',
      teamName: r.entity?.competitorName || '',
      value: Number(r.entity?.value || r.value || rows.length - r.position || 0),
      athleteId: r.entity?.id,
      shortName: r.entity?.shortName || '',
    }));

    parsed.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    const top = parsed.slice(0, limit);

    let msg = `⚽ *GOLEADORES — MUNDIAL 2026*\n\n`;
    top.forEach((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      msg += `${medal} *${p.name}* — ${pluralGoles(p.value)}`;
      if (p.teamName) msg += ` _(${p.teamName})_`;
      msg += '\n';
    });

    const topScorerPhoto = top[0]?.athleteId ? getAthletePhotoUrl(top[0].athleteId) : null;
    return { text: msg.trim(), photoUrl: topScorerPhoto };
  } catch (e) {
    return { text: `⚠️ No pude obtener goleadores: ${e.message}` };
  }
}

function pluralGoles(n) {
  if (n === 1) return '1 gol';
  return `${n} goles`;
}

module.exports = {
  MUNDIAL_ID,
  getNoticias,
  getEquipoIdeal,
  getBracket,
  getHistorial,
  getGoleadores,
};
