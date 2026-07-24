require('dotenv').config();
const matchSearch = require('../services/matchSearch');
const mundialCache = require('../services/mundialCache');
const { getCompetitionName } = require('../services/competitionName');
const { pool } = require('../database/connection');
const db = require('../database/db');

const COMPETITION_ID = parseInt(process.env.PRIMARY_COMPETITION_ID || '5930', 10);

const STAT_LABELS = {
  1: 'Goles',
  2: 'Goles 1T',
  3: 'Asistencias',
  6: 'Córners',
  8: 'Córners 1T',
  14: 'Tiros',
  15: 'Tiros al arco',
  21: 'Fueras de juego',
  31: 'Tarjetas amarillas',
  32: 'Tarjetas rojas',
  41: 'Posesión %',
  43: 'Pases totales',
  45: 'Pases completados %',
  52: 'Faltas',
  56: 'Saques de banda',
};

const SCORE_STAT_ID = 1;
const LINE_TYPE_LABELS = {
  1: 'Ganador',
  3: 'Over/Under',
  7: 'Primer gol',
  12: 'Ambos marcan',
  14: 'Doble oportunidad',
};

function pct(n) {
  if (n == null || isNaN(n)) return '-';
  const v = Number(n);
  return `${(v * 100).toFixed(0)}%`;
}

function trendArrow(p) {
  if (p == null) return '·';
  const v = Number(p);
  if (v >= 0.75) return '🔥';
  if (v >= 0.6) return '📈';
  if (v >= 0.5) return '➖';
  return '📉';
}

function fmtGameTitle(g) {
  if (!g) return 'partido';
  const home = g.homeCompetitor?.name || '?';
  const away = g.awayCompetitor?.name || '?';
  return `${home} vs ${away}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica' });
  } catch (_) {
    return iso;
  }
}

async function fetchGameById(gameId) {
  const game = await mundialCache.getGameById(Number(gameId));
  if (game) return game;
  return null;
}

async function formatTipForGame(game) {
  if (!game || !game.id) return '⚠️ Partido no encontrado.';

  const gameId = Number(game.id);
  let tipDoc = null;

  try {
    const rows = await db.execAdvanced(
      'SELECT data FROM trends WHERE scope = $1 AND game_id = $2',
      ['game', gameId]
    );
    const trends = rows.map(r => r.data);
    if (trends.length) {
      const sorted = trends.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      tipDoc = {
        confidenceScore: sorted.slice(0, 5).reduce((s, t) => s + (t.percentage || 0), 0) / 5,
        topTrends: sorted.slice(0, 5),
        allTrends: sorted,
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (_) {}

  let msg = `🎯 *TIP — ${fmtGameTitle(game).toUpperCase()}*\n\n`;
  msg += `🆔 Game ID: \`${gameId}\`\n`;
  msg += `📅 ${fmtDateTime(game.startTime)}\n`;
  if (game.stageName) msg += `🏆 ${game.stageName}\n`;

  if (game.statusGroup === 1) msg += `🔴 *EN VIVO*\n`;
  else if (game.statusGroup === 4) msg += `✅ Finalizado\n`;
  else msg += `⏳ Programado\n`;
  msg += '\n';

  if (!tipDoc || !Array.isArray(tipDoc.topTrends) || tipDoc.topTrends.length === 0) {
    msg += `ℹ️ Aún no hay tips generados para este partido.\n\n`;
    msg += `💡 Probá \`/tendencias ${fmtGameTitle(game)}\` o esperá al próximo refresh.`;
    return msg;
  }

  const confidence = tipDoc.confidenceScore != null ? pct(tipDoc.confidenceScore) : '-';
  msg += `📊 *Confianza del modelo:* *${confidence}*\n`;
  msg += `🧠 Generado: ${tipDoc.generatedAt ? tipDoc.generatedAt.split('T')[0] : '-'}\n\n`;

  msg += `🔥 *Top ${Math.min(5, tipDoc.topTrends.length)} tendencias:*\n`;
  tipDoc.topTrends.slice(0, 5).forEach((t, i) => {
    const line = LINE_TYPE_LABELS[t.lineTypeId] || `Tipo ${t.lineTypeId}`;
    const arrow = trendArrow(t.percentage);
    msg += `${i + 1}. ${arrow} *${pct(t.percentage)}* — ${t.betCTA || t.text || line}\n`;
    msg += `     _${t.text || line}_\n`;
  });

  if (tipDoc.allTrends && tipDoc.allTrends.length > tipDoc.topTrends.length) {
    msg += `\n_(${tipDoc.allTrends.length - tipDoc.topTrends.length} trends más disponibles con /tendencias)_`;
  }

  return msg;
}

async function getTipPartido(home, away) {
  const game = await matchSearch.findGameByTeams(home, away);
  if (!game) {
    return `⚠️ No encontré un partido entre *${home}* y *${away}*.\n\n` +
      `💡 Probá \`/live\` para ver partidos en vivo o \`/tendencias\` para el top Mundial.`;
  }
  return formatTipForGame(game);
}

async function getTendencias(scope = 'competition', id = null, limit = 10) {
  const safeScope = scope === 'game' ? 'game' : 'competition';
  const safeId = id != null ? Number(id) : COMPETITION_ID;

  let trends = [];
  try {
    const rows = await db.execAdvanced(
      'SELECT data FROM trends WHERE scope = $1 AND entity_id = $2',
      [safeScope, safeId]
    );
    trends = rows.map(r => r.data);
  } catch (e) {
    return `⚠️ No pude leer tendencias: ${e.message}`;
  }

  if (!trends || trends.length === 0) {
    if (safeScope === 'game') {
      return `ℹ️ No hay tendencias registradas para el gameId \`${safeId}\`. ` +
        `Las tendencias se generan cuando el partido está programado.`;
    }
    return `ℹ️ No hay tendencias disponibles todavía.`;
  }

  const seen = new Set();
  const unique = [];
  for (const t of trends) {
    const key = `${t.betCTA || LINE_TYPE_LABELS[t.lineTypeId] || ''}|${t.lineTypeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  if (safeScope === 'competition') {
    const activeGames = await matchSearch.findUpcomingGames(64);
    const liveGames = await matchSearch.findLiveGames();
    const activeTeams = new Set();
    for (const g of [...activeGames, ...liveGames]) {
      if (g.homeCompetitor?.name) activeTeams.add(g.homeCompetitor.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      if (g.awayCompetitor?.name) activeTeams.add(g.awayCompetitor.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    }
    const filtered = [];
    for (const t of unique) {
      const haystack = `${t.betCTA || ''} ${t.text || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mentionsTeam = [...activeTeams].some((team) => haystack.includes(team));
      if (!mentionsTeam) {
        filtered.push(t);
        continue;
      }
      const hasUpcoming = [...activeTeams].some((team) => haystack.includes(team));
      if (hasUpcoming) filtered.push(t);
    }
    unique.length = 0;
    unique.push(...filtered);
  }

  let title;
  if (safeScope === 'game') {
    const game = await fetchGameById(safeId);
    title = `🔥 *TENDENCIAS — ${(game ? fmtGameTitle(game) : `Game ${safeId}`).toUpperCase()}*`;
  } else {
    const compName = await getCompetitionName(COMPETITION_ID);
    title = `🔥 *TOP TENDENCIAS — ${compName}*`;
  }

  let msg = `${title}\n\n`;
  unique.forEach((t, i) => {
    const line = LINE_TYPE_LABELS[t.lineTypeId] || `Tipo ${t.lineTypeId}`;
    const arrow = trendArrow(t.percentage);
    msg += `${i + 1}. ${arrow} *${pct(t.percentage)}* — ${t.betCTA || line}\n`;
    msg += `     _${t.text}_\n`;
  });

  msg += `\n_Leyenda: 🔥 ≥75% · 📈 ≥60% · ➖ ≥50% · 📉 <50%_`;
  return msg;
}

async function getTendenciasByTeams(home, away, limit = 10) {
  if (!home || !away) {
    return '⚠️ Formato: `/tendencias [eq1] vs [eq2]`\n\nEj: `/tendencias brasil vs argentina`';
  }

  const game = await matchSearch.findGameByTeams(home, away);
  if (!game) {
    return `⚠️ No encontré un partido entre *${home}* y *${away}*.\n\n` +
      `💡 Probá \`/live\` para ver partidos en vivo ahora, o usá el top Mundial: \`/tendencias\`.`;
  }

  const gameId = Number(game.id);
  const result = await getTendencias('game', gameId, limit);

  const statusText = game.statusGroup === 1 ? '🔴 EN VIVO'
                   : game.statusGroup === 2 ? '⏳ Programado'
                   : game.statusGroup === 4 ? '✅ Finalizado'
                   : '';
  const when = fmtDateTime(game.startTime);
  const header = `\n📅 ${when}${statusText ? ' · ' + statusText : ''} · 🆔 gameId \`${gameId}\`\n`;

  return header + result;
}

async function getLiveGames() {
  const games = await matchSearch.findLiveGames();
  if (!games || games.length === 0) {
    return `🟢 *EN VIVO*\n\n` +
      `No hay partidos en vivo en este momento.\n\n` +
      `💡 Tip: \`/proximos\` para ver los próximos o \`/partidos\` para los de hoy.`;
  }

  let msg = `🔴 *EN VIVO (${games.length})*\n\n`;
  games.forEach((g) => {
    const home = g.homeCompetitor?.name || '?';
    const away = g.awayCompetitor?.name || '?';
    const hs = g.homeCompetitor?.score ?? '-';
    const as = g.awayCompetitor?.score ?? '-';
    msg += `⚽ *${home} ${hs} - ${as} ${away}*\n`;
    msg += `   ⏱ ${g.statusText || 'En vivo'} · 🆔 \`${g.id}\`\n`;
    msg += `   📊 \`/stats-vivo ${g.id}\` · 👥 \`/alineacion ${g.id}\`\n\n`;
  });
  return msg.trim();
}

async function getStatsVivo(gameId) {
  if (!/^\d+$/.test(String(gameId))) {
    return '⚠️ gameId inválido. Usá un número (ej: `/stats-vivo 4749268`).';
  }
  const gid = Number(gameId);

  const game = await fetchGameById(gid);
  if (!game) {
    return `⚠️ No encontré el partido con gameId \`${gid}\`.`;
  }

  let snapshot = null;
  try {
    const r = await db.execAdvanced(
      "SELECT last_snapshot, updated_at FROM scores365_state WHERE game_id = $1",
      [gid]
    );
    if (r[0]?.last_snapshot) {
      snapshot = r[0].last_snapshot;
    }
  } catch (_) {}

  if (!snapshot || !Array.isArray(snapshot.statistics) || snapshot.statistics.length === 0) {
    const rows = await db.execAdvanced('SELECT data FROM game_stats WHERE game_id = $1', [gid]);
    if (rows.length && rows[0].data?.statistics?.length) {
      const liveStats = rows[0].data;
      snapshot = { statistics: liveStats.statistics, statisticsFilters: liveStats.statisticsFilters || [], lastUpdateId: liveStats.lastUpdateId, fetchedAt: new Date().toISOString() };
    }
  }

  if (!snapshot || !Array.isArray(snapshot.statistics) || snapshot.statistics.length === 0) {
    return `ℹ️ No hay snapshot en vivo para *${fmtGameTitle(game)}* todavía.\n\n` +
      `El poller guarda datos cada 25s durante partidos EN VIVO. Si el partido ya terminó, probá \`/h2h ${gid}\`.`;
  }

  const homeId = game.homeCompetitor?.id;
  const awayId = game.awayCompetitor?.id;
  const homeName = game.homeCompetitor?.name || 'Local';
  const awayName = game.awayCompetitor?.name || 'Visitante';

  const find = (statId, compId) => {
    const s = snapshot.statistics.find((x) => x.id === statId && x.competitorId === compId);
    return s ? s.value : '-';
  };

  const homeScore = find(SCORE_STAT_ID, homeId);
  const awayScore = find(SCORE_STAT_ID, awayId);

  let msg = `📊 *STATS EN VIVO — ${fmtGameTitle(game).toUpperCase()}*\n\n`;
  msg += `🔴 Marcador: *${homeName} ${homeScore} - ${awayScore} ${awayName}*\n`;
  msg += `🆔 Game ID: \`${gid}\` · ⏱ ${game.statusText || '-'}\n`;
  msg += `🕒 Snapshot: ${snapshot.fetchedAt ? snapshot.fetchedAt.split('T')[0] + ' ' + (snapshot.fetchedAt.split('T')[1] || '').slice(0, 5) : '-'}\n\n`;

  msg += `┌────────────────────────────┬──────────┬──────────┐\n`;
  msg += `│ Métrica                    │ ${pad(homeName, 8)} │ ${pad(awayName, 8)} │\n`;
  msg += `├────────────────────────────┼──────────┼──────────┤\n`;

  const metricIds = [1, 6, 14, 15, 31, 32, 41, 43, 52];
  metricIds.forEach((id) => {
    const label = pad(STAT_LABELS[id] || `#${id}`, 26);
    const h = String(find(id, homeId));
    const a = String(find(id, awayId));
    msg += `│ ${label} │ ${pad(h, 8)} │ ${pad(a, 8)} │\n`;
  });
  msg += `└────────────────────────────┴──────────┴──────────┘\n`;

  msg += `\n💡 Tip: \`/alineacion ${gid}\` · \`/h2h ${gid}\``;
  return msg;
}

function pad(s, w) {
  s = String(s ?? '');
  if (s.length > w) return s.slice(0, w - 1) + '…';
  return s + ' '.repeat(Math.max(0, w - s.length));
}

async function getAlineacion(gameId) {
  if (!/^\d+$/.test(String(gameId))) {
    return '⚠️ gameId inválido. Usá un número (ej: `/alineacion 4749268`).';
  }
  const gid = Number(gameId);

  const game = await fetchGameById(gid);
  if (!game) {
    return `⚠️ No encontré el partido con gameId \`${gid}\` .`;
  }

  let overview = null;
  try {
    const rows = await db.execAdvanced('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
    if (rows.length) overview = rows[0].data;
  } catch (_) {}

  let g = overview?.game || null;
  if (g) {
    const homeLineup = g.homeCompetitor?.lineups?.members || [];
    const awayLineup = g.awayCompetitor?.lineups?.members || [];
    if (homeLineup.length === 0 && awayLineup.length === 0) {
      try {
        const matchupId = `${game.homeCompetitor?.id || 0}-${game.awayCompetitor?.id || 0}-${COMPETITION_ID}`;
        const fresh = await db.execAdvanced('SELECT data FROM game_overviews WHERE game_id = $1', [gid]);
        if (fresh.length && fresh[0].data?.game?.homeCompetitor?.lineups?.members?.length) {
          g = fresh[0].data.game;
        }
      } catch (_) {}
    }
  }

  if (!g) {
    if (game.statusGroup === 2) {
      return `ℹ️ Las alineaciones de *${fmtGameTitle(game)}* se publican cerca del partido. ` +
        `Volvé a probar 1h antes del kickoff.`;
    }
    return `ℹ️ No tengo alineaciones guardadas para \`${gid}\`.`;
  }

  const home = g.homeCompetitor?.name || game.homeCompetitor?.name || 'Local';
  const away = g.awayCompetitor?.name || game.awayCompetitor?.name || 'Visitante';
  const homeLineup = g.homeCompetitor?.lineups?.members || [];
  const awayLineup = g.awayCompetitor?.lineups?.members || [];
  const homeFormation = g.homeCompetitor?.lineups?.formation || '';
  const awayFormation = g.awayCompetitor?.lineups?.formation || '';

  if (homeLineup.length === 0 && awayLineup.length === 0) {
    return `ℹ️ Todavía no hay alineaciones publicadas para *${fmtGameTitle(game)}*.`;
  }

  const memberMap = {};
  (g.members || []).forEach(m => { if (m.id != null) memberMap[m.id] = m; });

  let msg = `👥 *ALINEACIONES — ${fmtGameTitle(game).toUpperCase()}*\n\n`;
  msg += `🆔 Game ID: \`${gid}\` · 📅 ${fmtDateTime(game.startTime)}\n\n`;

  const renderSide = (side, name, formation, lineup) => {
    let out = `🏠 *${name}*${formation ? `  (${formation})` : ''}\n`;
    if (!lineup.length) {
      out += `   _sin datos_\n`;
      return out;
    }
    const byPos = { Portero: [], Defensa: [], 'Centro Defensivo': [], Mediocampista: [], Extremo: [], Delantero: [], 'Centro Delantero': [], Otros: [] };
    lineup.forEach((m) => {
      const pos = m.position?.name || 'Otros';
      if (!byPos[pos]) byPos[pos] = [];
      byPos[pos].push(m);
    });
    Object.keys(byPos).forEach((pos) => {
      if (!byPos[pos].length) return;
      out += `   _${pos}:_ `;
      out += byPos[pos].map((m) => {
        const info = memberMap[m.id];
        return info?.shortName || info?.name || m.shortName || m.name || '?';
      }).join(', ');
      out += `\n`;
    });
    return out + '\n';
  };

  msg += renderSide('home', home, homeFormation, homeLineup);
  msg += renderSide('away', away, awayFormation, awayLineup);

  msg += `💡 \`/previa ${gid}\` para stats pre-partido · \`/stats-vivo ${gid}\` para live`;
  return msg;
}

async function getPrevia(gameId) {
  if (!/^\d+$/.test(String(gameId))) {
    return '⚠️ gameId inválido. Usá un número (ej: `/previa 4749268`).';
  }
  const gid = Number(gameId);

  const game = await fetchGameById(gid);
  if (!game) {
    return `⚠️ No encontré el partido con gameId \`${gid}\` .`;
  }

  if (game.statusGroup === 4) {
    return `ℹ️ *${fmtGameTitle(game)}* ya finalizó. ` +
      `Para análisis, probá \`/h2h ${gid}\`.`;
  }

  let pre = null;
  try {
    const rows = await db.execAdvanced('SELECT data FROM game_pre_stats WHERE game_id = $1', [gid]);
    if (rows.length) pre = rows[0].data;
  } catch (_) {}

  const stats = pre?.statistics || [];
  if (!Array.isArray(stats) || stats.length === 0) {
    return `ℹ️ No hay pre-stats para *${fmtGameTitle(game)}* todavía. ` +
      `Se generan cuando el partido está programado (statusGroup=2).`;
  }

  const homeId = game.homeCompetitor?.id;
  const awayId = game.awayCompetitor?.id;

  let msg = `🔮 *PREVIA — ${fmtGameTitle(game).toUpperCase()}*\n\n`;
  msg += `🆔 Game ID: \`${gid}\` · 📅 ${fmtDateTime(game.startTime)}\n\n`;

  const grouped = {};
  stats.forEach((s) => {
    const cat = s.categoryName || 'Top';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  Object.keys(grouped).forEach((cat) => {
    msg += `📂 *${cat}*\n`;
    const seen = new Set();
    grouped[cat].forEach((s) => {
      const partner = grouped[cat].find((x) => x.id === s.id && x.competitorId !== s.competitorId);
      const local = s.competitorId === homeId ? s.value : partner?.value;
      const visit = s.competitorId === awayId ? s.value : partner?.value;
      if (seen.has(s.id)) return;
      seen.add(s.id);
      msg += `   ${pad(s.name || `#${s.id}`, 32)} ${pad(local ?? '-', 8)} | ${pad(visit ?? '-', 8)}\n`;
    });
    msg += '\n';
  });

  return msg.trim();
}

async function getH2H(gameId) {
  if (!/^\d+$/.test(String(gameId))) {
    return '⚠️ gameId inválido. Usá un número (ej: `/h2h 4749268`).';
  }
  const gid = Number(gameId);

  const game = await fetchGameById(gid);
  if (!game) {
    return `⚠️ No encontré el partido con gameId \`${gid}\` .`;
  }

  let h2h = null;
  try {
    const rows = await db.execAdvanced('SELECT data FROM game_h2h WHERE game_id = $1', [gid]);
    if (rows.length) h2h = rows[0].data;
  } catch (_) {}

  if (!h2h || !h2h.game) {
    return `ℹ️ No tengo historial H2H para *${fmtGameTitle(game)}*.`;
  }

  const g = h2h.game;
  const home = g.homeCompetitor?.name || game.homeCompetitor?.name;
  const away = g.awayCompetitor?.name || game.awayCompetitor?.name;

  let msg = `🤝 *H2H — ${home.toUpperCase()} VS ${away.toUpperCase()}*\n\n`;
  msg += `🆔 Game ID: \`${gid}\` · 📅 ${fmtDateTime(game.startTime)}\n\n`;

  const recentHome = g.homeCompetitor?.recentGames || [];
  const recentAway = g.awayCompetitor?.recentGames || [];

  if (recentHome.length > 0) {
    msg += `📈 *Últimos partidos de ${home}:*\n`;
    recentHome.slice(0, 5).forEach((rg) => {
      const homeSide = rg.homeCompetitor?.name || '?';
      const awaySide = rg.awayCompetitor?.name || '?';
      const hs = rg.homeCompetitor?.score ?? '-';
      const as_ = rg.awayCompetitor?.score ?? '-';
      const date = rg.startTime ? rg.startTime.split('T')[0] : '';
      msg += `   ${date} · ${homeSide} ${hs}-${as_} ${awaySide}\n`;
    });
    msg += '\n';
  }

  if (recentAway.length > 0) {
    msg += `📈 *Últimos partidos de ${away}:*\n`;
    recentAway.slice(0, 5).forEach((rg) => {
      const homeSide = rg.homeCompetitor?.name || '?';
      const awaySide = rg.awayCompetitor?.name || '?';
      const hs = rg.homeCompetitor?.score ?? '-';
      const as_ = rg.awayCompetitor?.score ?? '-';
      const date = rg.startTime ? rg.startTime.split('T')[0] : '';
      msg += `   ${date} · ${homeSide} ${hs}-${as_} ${awaySide}\n`;
    });
    msg += '\n';
  }

  const h2hGames = g.h2hGames || [];
  if (h2hGames.length > 0) {
    msg += `⚔️ *Enfrentamientos directos históricos:*\n`;
    h2hGames.slice(0, 5).forEach((m) => {
      const homeSide = m.homeCompetitor?.name || '?';
      const awaySide = m.awayCompetitor?.name || '?';
      const hs = m.homeCompetitor?.score ?? '-';
      const as_ = m.awayCompetitor?.score ?? '-';
      const date = m.startTime ? m.startTime.split('T')[0] : '';
      msg += `   ${date} · ${homeSide} ${hs}-${as_} ${awaySide}\n`;
    });
  } else {
    msg += `ℹ️ Sin enfrentamientos directos registrados.`;
  }

  return msg.trim();
}

async function getPredicciones(gameId) {
  if (!/^\d+$/.test(String(gameId))) {
    return '⚠️ gameId inválido. Usá un número (ej: `/predicciones 4749268`).';
  }
  const gid = Number(gameId);

  const game = await fetchGameById(gid);
  if (!game) {
    return `⚠️ No encontré el partido con gameId \`${gid}\` .`;
  }

  let pred = null;
  try {
    const rows = await db.execAdvanced('SELECT data FROM predictions WHERE game_id = $1', [gid]);
    if (rows.length) pred = rows[0].data;
  } catch (_) {}

  if (!pred || !pred.promotedPredictions?.predictions) {
    return `ℹ️ No hay predicciones de la comunidad para *${fmtGameTitle(game)}*.`;
  }

  let msg = `🗳️ *PREDICCIONES — ${fmtGameTitle(game).toUpperCase()}*\n\n`;
  msg += `🆔 Game ID: \`${gid}\`\n\n`;

  pred.promotedPredictions.predictions.forEach((p) => {
    msg += `❓ *${p.title || 'Pregunta'}*`;
    if (p.totalVotes) msg += `  _(${p.totalVotes.toLocaleString('es')} votos)_`;
    msg += `\n`;
    if (Array.isArray(p.options)) {
      p.options.forEach((opt) => {
        const total = p.options.reduce((acc, o) => acc + (o.votes || 0), 0) || 1;
        const pp = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
        msg += `   • ${opt.text || opt.title || 'Opción'}: *${pp}%* _(${opt.votes || 0} votos)_\n`;
      });
    }
    msg += '\n';
  });

  return msg.trim();
}

async function getFixture() {
  try {
    const rows = await db.execAdvanced(
      'SELECT data FROM games WHERE competition_id = $1 AND status_group = 2 ORDER BY start_time ASC LIMIT 20',
      [COMPETITION_ID]
    );
    const games = rows.map(r => r.data);

    if (!games.length) {
      return `📅 *PRÓXIMOS PARTIDOS*\n\nNo hay partidos programados.`;
    }

    const byDate = {};
    for (const g of games) {
      const d = (g.startTime || '').split('T')[0] || 'sin fecha';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(g);
    }

    const compName = await getCompetitionName(COMPETITION_ID);
    let msg = `📅 *PRÓXIMOS PARTIDOS — ${compName}*\n\n`;
    Object.keys(byDate).slice(0, 5).forEach((d) => {
      const dateLabel = new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      msg += `━━━ *${dateLabel}* ━━━\n`;
      byDate[d].forEach((g) => {
        const home = g.homeCompetitor?.name || g.homeTeam || '?';
        const away = g.awayCompetitor?.name || g.awayTeam || '?';
        const time = g.startTime ? fmtDateTime(g.startTime) : '';
        const venue = g.venue?.name || g.stadium || '';
        msg += `⚽ *${home}* vs *${away}*\n`;
        if (time) msg += `   🕐 ${time}\n`;
        if (venue) msg += `   🏟 ${venue}\n`;
        msg += `   🆔 \`${g.id}\`\n\n`;
      });
    });
    return msg.trim();
  } catch (e) {
    return `⚠️ Error al obtener fixtures: ${e.message}`;
  }
}

async function getOutrights() {
  try {
    const rows = await db.execAdvanced('SELECT data FROM odds_outrights WHERE competition_id = $1', [COMPETITION_ID]);
    if (!rows.length) {
      return `🏆 *CUOTAS OUTRIGHT*\n\nNo hay cuotas disponibles todavía.`;
    }

    const live = rows[0].data;
    if (!live?.markets?.length) {
      return `🏆 *CUOTAS OUTRIGHT*\n\nNo hay cuotas disponibles todavía.`;
    }

    const compName = await getCompetitionName(COMPETITION_ID);
    let msg = `🏆 *CUOTAS OUTRIGHT — ${compName}*\n\n`;
    live.markets.slice(0, 8).forEach((m, i) => {
      msg += `📊 *${m.marketName || m.title || 'Mercado ' + (i + 1)}*\n`;
      if (Array.isArray(m.lines)) {
        m.lines.slice(0, 10).forEach((line) => {
          const name = line.name || line.competitorName || line.participantName || line.label || '?';
          const odd = line.price || line.odds || line.value || '-';
          const pct2 = line.percentage ? pct(line.percentage) : '';
          msg += `   ${name}: *${odd}* ${pct2 ? `_(${pct2})_` : ''}\n`;
        });
      }
      msg += '\n';
    });

    return msg.trim();
  } catch (e) {
    return `⚠️ Error al obtener cuotas outright: ${e.message}`;
  }
}

async function getOdds(gameId) {
  if (!/^\d+$/.test(String(gameId))) {
    return '⚠️ gameId inválido. Usá un número (ej: `/odds 4749268`).';
  }
  const gid = Number(gameId);

  const game = await fetchGameById(gid);
  if (!game) {
    return `⚠️ No encontré el partido con gameId \`${gid}\` .`;
  }

  let doc = null;
  try {
    const rows = await db.execAdvanced('SELECT data FROM odds_lines WHERE game_id = $1', [gid]);
    if (rows.length) doc = rows[0].data;
  } catch (_) {}

  if (!doc || !doc.lines?.length) {
    return `ℹ️ No hay cuotas para *${fmtGameTitle(game)}* todavía.`;
  }

  const home = game.homeCompetitor?.name || 'Local';
  const away = game.awayCompetitor?.name || 'Visitante';

  let msg = `🎲 *CUOTAS — ${fmtGameTitle(game).toUpperCase()}*\n\n`;
  msg += `🆔 \`${gid}\` · 📅 ${fmtDateTime(game.startTime)}\n\n`;

  const byType = {};
  for (const line of doc.lines) {
    const type = LINE_TYPE_LABELS[line.lineTypeId] || `Tipo ${line.lineTypeId}`;
    if (!byType[type]) byType[type] = [];
    byType[type].push(line);
  }

  Object.keys(byType).forEach((type) => {
    msg += `📊 *${type}*\n`;
    byType[type].slice(0, 8).forEach((l) => {
      const label = l.label || l.betCTA || l.text || l.name || '?';
      const price = l.price || l.odds || l.value || '-';
      msg += `   ${label}: *${price}*\n`;
    });
    msg += '\n';
  });

  return msg.trim();
}

module.exports = {
  COMPETITION_ID,
  getTipPartido,
  formatTipForGame,
  getTendencias,
  getTendenciasByTeams,
  getLiveGames,
  getStatsVivo,
  getAlineacion,
  getPrevia,
  getH2H,
  getPredicciones,
  getFixture,
  getOutrights,
  getOdds,
};
