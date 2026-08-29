/**
 * src/application/stats/useCases.js — Use-cases de estadísticas (Fase 8).
 *
 * Reemplazan los métodos de `handlers/mundialistaStatsHandler.js`:
 *   - getNoticias     → createGetNoticias
 *   - getEquipoIdeal  → createGetEquipoIdeal
 *   - getBracket      → createGetBracket
 *   - getHistorial    → createGetHistorial
 *   - getGoleadores   → createGetGoleadores
 *
 * Cada use-case devuelve el texto listo para enviar al chat. Las dependencias
 * (stats repo, match search, servicios de nombres/fotos) se inyectan en la
 * factoría — el dominio no toca pg ni módulos globales.
 *
 * Los helpers `fmtDate`, `pad`, `cleanupTitle` y `pluralGoles` se replican
 * verbatim desde el handler legacy; el formateo a Telegram se mantiene
 * idéntico para preservar el comportamiento byte a byte (Auditoría 2026-Q3).
 */

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Costa_Rica',
    });
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

function pluralGoles(n) {
  if (n === 1) return '1 gol';
  return `${n} goles`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /noticias                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetNoticias({ statsRepository, matchSearch, getCompetitionName, competitionId }) {
  if (!statsRepository) throw new Error('createGetNoticias: statsRepository required');
  if (!competitionId) throw new Error('createGetNoticias: competitionId required');

  return async function getNoticias({ equipo = null, limit = 10 } = {}) {
    try {
      if (equipo) {
        const games = await matchSearch.findGamesByCompetitorName(equipo, { limit: 50 });
        if (!games || games.length === 0) {
          return `📰 No encontré partidos de *${equipo}*.\n\n💡 Probá \`/noticias\` para ver las últimas.`;
        }
        try {
          const allNewsRows = await statsRepository.getNews(competitionId, 'competition', 200);
          const allNews = allNewsRows.map((r) => r.data);
          const gameIds = games.map((g) => Number(g.id));
          let filtered = allNews.filter((n) => n.gameId && gameIds.includes(Number(n.gameId)));

          if (filtered.length === 0) {
            const compNews = allNews.filter((n) => n.scope === 'comp').slice(0, limit);
            const eq = equipo.toLowerCase();
            const matchNews = compNews.filter((n) => n.title && n.title.toLowerCase().includes(eq));
            if (matchNews.length === 0) {
              return `📰 No hay noticias específicas de *${equipo}* todavía.\n💡 Probá \`/noticias\` para ver las últimas.`;
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
        } catch (_) {
          return '📰 No hay noticias disponibles en este momento.';
        }
      }

      const rows = await statsRepository.getNews(competitionId, 'competition', limit);
      const news = rows.map((r) => r.data).filter((n) => n.scope === 'comp').slice(0, limit);
      if (!news || news.length === 0) return '📰 No hay noticias disponibles todavía.';

      const compName = await getCompetitionName(competitionId);
      let msg = `📰 *ÚLTIMAS NOTICIAS — ${compName}*\n\n`;
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
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /equipoideal                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetEquipoIdeal({ statsRepository, getCompetitionName, competitionId }) {
  if (!statsRepository) throw new Error('createGetEquipoIdeal: statsRepository required');

  return async function getEquipoIdeal() {
    try {
      const tow = await statsRepository.getTeamOfWeek(competitionId);
      if (!tow) return '🌟 No hay equipo de la semana disponible todavía.';

      const data = tow.data?.teamOfWeek || tow.data;
      if (!data || !data.lineup || !Array.isArray(data.lineup.members) || data.lineup.members.length === 0) {
        return '🌟 No hay equipo de la semana disponible todavía.';
      }

      const f = data.lineup.formation || '4-4-2';
      const members = data.lineup.members;
      const compName = await getCompetitionName(competitionId);

      let msg = `🌟 *EQUIPO IDEAL — ${compName}*\n`;
      msg += `📋 Formación: ${f}\n\n`;

      const byPos = {};
      const posOrder = ['Portero', 'Defensa', 'Mediocampista', 'Delantero'];
      members.forEach((m) => {
        const pos = m.position?.name || 'Otros';
        m._posSort = posOrder.indexOf(pos) >= 0 ? posOrder.indexOf(pos) : 99;
        if (!byPos[pos]) byPos[pos] = [];
        byPos[pos].push(m);
      });

      Object.keys(byPos)
        .sort((a, b) => (byPos[a][0]._posSort || 99) - (byPos[b][0]._posSort || 99))
        .forEach((pos) => {
          msg += `_${pos}:_\n`;
          byPos[pos].forEach((m) => {
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
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /llaves                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetBracket({ statsRepository, getCompetitionName, competitionId }) {
  if (!statsRepository) throw new Error('createGetBracket: statsRepository required');

  function formatGroupStage(stage) {
    if (!stage || !Array.isArray(stage.groups)) return '';
    let out = '📋 *FASE DE GRUPOS*\n\n';
    stage.groups.forEach((g) => {
      const name = g.name || 'Grupo ?';
      const competitors = (g.competitors || []).map((c) => c.name || c.shortName || '?');
      out += `  *${name}*: ${competitors.join(' · ')}\n`;
    });
    return out;
  }

  function formatKnockoutStages(stages) {
    if (!stages || stages.length === 0) return '';
    let out = '🗡️ *FASE ELIMINATORIA*\n\n';
    stages.forEach((s) => {
      const name = s.name || 'Ronda';
      const groups = s.groups || [];
      out += `━━ ${name} ━━\n`;

      if (groups.length === 0) {
        out += '   _sin datos_\n\n';
        return;
      }

      groups.forEach((g) => {
        const participants = (g.participants || []).map((p) => p.name || p.shortName || '?');
        const games = (g.games || []).map((gm) => {
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
          games.forEach((gm) => {
            out += `   ${gm}\n`;
          });
        }
      });
      out += '\n';
    });
    return out;
  }

  return async function getBracket(scope = 'eliminatorias') {
    try {
      const bracket = await statsRepository.getBracket(competitionId);
      if (!bracket || !bracket.data?.stages) {
        return '🏆 *LLAVES*\n\n' +
          'La estructura de brackets no está disponible todavía.\n\n' +
          '💡 Probá:\n' +
          '• `/mundial` para ver la tabla general\n' +
          '• `/grupo A` (A-L) para tabla de un grupo';
      }

      const stages = bracket.data.stages;
      if (stages.length === 0) return '🏆 El doc de brackets no tiene stages.';

      const compName = await getCompetitionName(competitionId);
      let msg = `🏆 *LLAVES ${compName}*\n\n`;

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
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /historial                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetHistorial({ statsRepository, getCompetitionName, getSeasonLabel, competitionId }) {
  if (!statsRepository) throw new Error('createGetHistorial: statsRepository required');
  if (!getSeasonLabel) throw new Error('createGetHistorial: getSeasonLabel required');

  async function getHistorialByYear(year) {
    const allDocs = await statsRepository.getCompetitionHistory(competitionId);
    const allRows = [...allDocs].sort((a, b) => a.seasonNum - b.seasonNum);
    const seasonLabels = await Promise.all(
      allRows.map((r) => getSeasonLabel(competitionId, r.data?.seasonNum))
    );
    const matchIdx = seasonLabels.findIndex((l) => l === String(year));
    const match = matchIdx >= 0 ? allRows[matchIdx] : null;
    if (!match) {
      const available = seasonLabels.filter(Boolean).join(', ');
      return `🏆 No hay datos para ${year}. Ediciones disponibles: ${available}.`;
    }

    const rows = allDocs.filter((r) => r.seasonNum === match.data?.seasonNum);
    if (!rows.length) return `🏆 No encontré datos para ${year}.`;

    const doc = rows[0].data;
    const g = doc.group;
    if (!g) return `🏆 El doc de ${year} no tiene datos de final.`;

    const participants = g.participants || [];
    const games = g.games || [];
    const p1 = participants[0]?.name || '?';
    const p2 = participants[1]?.name || '?';

    let msg = `🏆 *${year} — ${p1} vs ${p2}*\n\n`;
    msg += `🏟️ Sede: ${games[0]?.venue?.name || '?'}\n`;
    msg += `🥇 Campeón: *${p1}*\n`;
    msg += `� Subcampeón: *${p2}*\n`;
    return msg.trim();
  }

  async function getHistorialByTeam(team) {
    const docs = await statsRepository.getCompetitionHistory(competitionId);
    if (!docs || docs.length === 0) return '🏆 No hay historial disponible.';

    const teamLower = team.toLowerCase();
    const relevant = docs.filter((d) => {
      const parts = (d.data?.group?.participants || []).map((p) => (p.name || '').toLowerCase());
      return parts.some((p) => p.includes(teamLower) || teamLower.includes(p));
    });

    if (relevant.length === 0) {
      const allTeams = new Set();
      docs.forEach((d) => (d.data?.group?.participants || []).forEach((p) => allTeams.add(p.name)));
      const list = [...allTeams].sort().join(', ');
      return `🏆 *${team}* no aparece en el historial.\n\nEquipos disponibles: ${list}`;
    }

    let msg = `🏆 *${team.toUpperCase()} EN EL HISTORIAL*\n\n`;
    for (const d of relevant) {
      const year = await getSeasonLabel(competitionId, d.data?.seasonNum);
      const participants = d.data?.group?.participants || [];
      const p1 = participants[0]?.name || '?';
      const p2 = participants[1]?.name || '?';
      const isChampion = p1.toLowerCase().includes(teamLower);
      const isRunnerUp = p2.toLowerCase().includes(teamLower);
      const role = isChampion ? '🥇 Campeón' : (isRunnerUp ? '🥈 Subcampeón' : '🎗️ Finalista');
      msg += `*${year}*: ${role} (${p1} vs ${p2})\n`;
    }
    return msg.trim();
  }

  return async function getHistorial(arg = null) {
    try {
      if (arg && /^\d{4}$/.test(String(arg))) return getHistorialByYear(Number(arg));
      if (arg && String(arg).trim()) return getHistorialByTeam(String(arg).trim());

      const docs = await statsRepository.getCompetitionHistory(competitionId);
      if (!docs || docs.length === 0) return '🏆 No hay historial del Mundial disponible.';

      let msg = '🏆 *HISTORIAL*\n\n';
      for (const d of docs) {
        const year = await getSeasonLabel(competitionId, d.data?.seasonNum);
        const participants = d.data?.group?.participants || [];
        const champion = participants[0]?.name || '?';
        const runnerUp = participants[1]?.name || '?';
        const venue = d.data?.group?.games?.[0]?.venue?.name || '';
        const emoji = String(d.data?.seasonNum) === '24' ? '🥇 ' : '';
        msg += `${emoji}*${year}*: ${champion} 🇨🇵 ${runnerUp || ''}`;
        if (venue) msg += ` _(${venue})_`;
        msg += '\n';
      }

      msg += '\n📖 Para ver detalle: `/historial 2022` o `/historial brasil`';
      return msg.trim();
    } catch (e) {
      return `⚠️ No pude obtener el historial: ${e.message}`;
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* /goleadores                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function createGetGoleadores({ statsRepository, getCompetitionName, getAthletePhotoUrl, competitionId }) {
  if (!statsRepository) throw new Error('createGetGoleadores: statsRepository required');

  return async function getGoleadores(limit = 10) {
    try {
      const stats = await statsRepository.getLatestTournamentStats(competitionId);
      if (!stats) return { text: '⚽ No hay ranking de goleadores disponible.' };

      const data = stats.data;
      const payload = Array.isArray(data?.stats) ? data.stats : Object.values(data?.stats || {});
      const goalsCat = payload.find((p) => p.name === 'Goles' || p.id === 1);
      const rawRows = goalsCat?.rows || [];
      if (!rawRows.length) return { text: '⚽ No hay ranking de goleadores disponible.' };

      const parsed = rawRows.map((r) => ({
        name: r.entity?.name || r.entity?.shortName || '?',
        teamName: r.entity?.competitorName || '',
        value: Number(r.entity?.value || r.value || rawRows.length - r.position || 0),
        athleteId: r.entity?.id,
        shortName: r.entity?.shortName || '',
      }));

      parsed.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
      const top = parsed.slice(0, limit);

      const compName = await getCompetitionName(competitionId);
      let msg = `⚽ *GOLEADORES — ${compName}*\n\n`;
      top.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        msg += `${medal} *${p.name}* — ${pluralGoles(p.value)}`;
        if (p.teamName) msg += ` _(${p.teamName})_`;
        msg += '\n';
      });

      const topScorerPhoto = top[0]?.athleteId && getAthletePhotoUrl ? getAthletePhotoUrl(top[0].athleteId) : null;
      return { text: msg.trim(), photoUrl: topScorerPhoto };
    } catch (e) {
      return { text: `�️ No pude obtener goleadores: ${e.message}` };
    }
  };
}

module.exports = {
  createGetNoticias,
  createGetEquipoIdeal,
  createGetBracket,
  createGetHistorial,
  createGetGoleadores,
};
