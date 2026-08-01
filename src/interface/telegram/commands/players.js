/**
 * src/interface/telegram/commands/players.js — Comandos de jugador/alineación
 * (Fase 7, Fase 3). /jugador y /alineacion. Relocalizados VERBATIM (incluyen la
 * lógica de fotos de alineación por posición y el perfil de jugador con eventos).
 */

const VS_RE = /^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i;
const ALINEACION_TRIGGERS = ['/alineacion', '/alineación', '/lineup', '/titulares'];

function registerPlayerCommands(router, deps) {
  const {
    cache, scores365, mundialista365,
    getAthletePhotoUrl, getAthleteThumbUrl, getTeamBadgeUrl,
    sendMessage, sendPhoto, sendMediaGroup, buildSingleGameKeyboard,
  } = deps;

  // ---- /alineacion (usage) ----
  router.register(ALINEACION_TRIGGERS, async (ctx) => {
    await sendMessage(ctx.chatId,
      `👥 *ALINEACIONES*\n\n` +
      `Uso: \`/alineacion <gameId>\` o \`/alineacion <eq1> vs <eq2>\`\n\n` +
      `Ejemplos:\n` +
      `• /alineacion 4749268\n` +
      `• /alineacion brasil vs argentina\n\n` +
      `💡 Las alineaciones se publican cerca del kickoff.`
    );
  });

  // ---- /alineacion <gameId | eq1 vs eq2> ----
  router.registerPrefix(ALINEACION_TRIGGERS, async (ctx) => {
    const chatId = ctx.chatId;
    const arg = ctx.arg;
    let gameId = arg;
    const isGameId = /^\d+$/.test(arg);

    if (!isGameId) {
      try {
        const vsMatch = arg.match(VS_RE);
        if (vsMatch) {
          const homeTeam = await cache.getTeamByName(vsMatch[1].trim());
          const awayTeam = await cache.getTeamByName(vsMatch[2].trim());
          if (homeTeam && awayTeam) {
            const match = await cache.findGameByCompetitors(homeTeam.id, awayTeam.id);
            if (match) gameId = match.id;
          }
        }
      } catch (e) {
        console.error('[alineacion] resolve error:', e.message);
      }
      if (!gameId || gameId === arg) {
        await sendMessage(chatId, `⚠️ No encontré el partido. Usá \`/alineacion <gameId>\` o \`/alineacion <eq1> vs <eq2>\`.`);
        return;
      }
    }
    const t = await mundialista365.getAlineacion(gameId);
    const overview = await cache.getMatchOverview(gameId).catch(() => null);
    const gameData = overview?.game || null;

    const homeComp = gameData?.homeCompetitor || null;
    const awayComp = gameData?.awayCompetitor || null;
    const homeBadge = homeComp?.id ? getTeamBadgeUrl(homeComp.id, homeComp.imageVersion) : null;
    const awayBadge = awayComp?.id ? getTeamBadgeUrl(awayComp.id, awayComp.imageVersion) : null;
    const badges = [];
    if (homeBadge) badges.push({ type: 'photo', media: homeBadge });
    if (awayBadge) badges.push({ type: 'photo', media: awayBadge });
    if (badges.length > 0) await sendMediaGroup(chatId, badges);
    await sendMessage(chatId, t);
    await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['previa', 'odds']) } });

    // Build member name/photo lookup from full squad
    const squadMembers = overview?.members || gameData?.members || [];
    const memberMap = {};
    squadMembers.forEach((m) => { if (m.id != null) memberMap[m.id] = m; });

    try {
      const sides = [
        { comp: homeComp, label: 'home' },
        { comp: awayComp, label: 'away' },
      ];
      for (const { comp } of sides) {
        if (!comp?.lineups?.members?.length) continue;
        const byPos = {};
        for (const m of comp.lineups.members) {
          const pos = m.position?.name || 'Otros';
          if (!byPos[pos]) byPos[pos] = [];
          byPos[pos].push(m);
        }
        for (const [pos, members] of Object.entries(byPos)) {
          if (!members.length) continue;
          const media = members.map((m) => {
            const info = memberMap[m.id];
            return {
              type: 'photo',
              media: getAthleteThumbUrl(info?.athleteId || m.athleteId, info?.imageVersion || m.imageVersion),
              caption: info?.shortName || info?.name || m.shortName || m.name || '?',
            };
          });
          for (let i = 0; i < media.length; i += 10) {
            await sendMediaGroup(chatId, media.slice(i, i + 10));
          }
        }
      }
    } catch (e) {
      console.error('[alineacion] error sending photos:', e.message);
    }
  });

  // ---- /jugador [<nombre>] ----
  // Registrado como exacto Y prefijo, ambos al mismo handler, porque el legacy
  // usaba `cmd.startsWith('/jugador')` con una extracción por regex que solo
  // strippea si hay espacio: `/jugador` pelado → name='/jugador' → búsqueda;
  // `/jugador ` (espacio) → name='' → usage; `/jugador foo` → name='foo'.
  const jugadorHandler = async (ctx) => {
    const chatId = ctx.chatId;
    const name = ctx.text.replace(/^\/(jugador|buscar)(?:@\w+)?\s+/i, '').trim();
    if (!name) {
      await sendMessage(chatId, '📖 Uso: `/jugador <nombre>` — ej: `/jugador mbappe`');
      return;
    }
    const matches = await cache.searchAthletes(name);
    if (!matches || !matches.length) {
      await sendMessage(chatId, `⚠️ No encontré al jugador "${name}".`);
      return;
    }
    const athlete = matches[0];
    const position = athlete.formationPosition?.name || athlete.position?.name || '';
    const age = athlete.age ? `, ${athlete.age} años` : '';
    let msg = `⚽ *${athlete.name}*\n📌 ${position}${age}\n🆔 ID: ${athlete.id}`;

    // Next game
    try {
      const nextData = await scores365.getAthleteNextGame(Number(athlete.id));
      if (nextData?.game) {
        const g = nextData.game;
        const h = g.homeCompetitor?.name || g.homeTeam || '?';
        const a = g.awayCompetitor?.name || g.awayTeam || '?';
        const d = g.startTime ? new Date(g.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
        msg += `\n📅 *Próximo:* ${h} vs ${a} ${d ? '(' + d + ')' : ''}`;
      }
    } catch (e) { console.warn('[athlete] nextData fetch failed:', e.message); }

    // Chart events (form)
    try {
      const chart = await scores365.getAthleteChartEvents(Number(athlete.id));
      if (chart?.events?.length) {
        const recent = chart.events.slice(-5);
        const icons = recent.map((e) => {
          if (e.type === 'goal' || e.type === 'assist') return '⚽';
          if (e.type === 'yellow') return '🟨';
          if (e.type === 'red') return '🟥';
          if (e.type === 'subin') return '⬆';
          if (e.type === 'subout') return '⬇';
          return '·';
        }).join(' ');
        msg += `\n📈 *Últimos eventos:* ${icons}`;
      }
    } catch (e) { console.warn('[athlete] chart events failed:', e.message); }

    const photoUrl = getAthletePhotoUrl(athlete.id);
    if (photoUrl) {
      await sendPhoto(chatId, photoUrl, msg);
    } else {
      await sendMessage(chatId, msg);
    }
  };
  router.register(['/jugador'], jugadorHandler);
  router.registerPrefix(['/jugador'], jugadorHandler);
}

module.exports = { registerPlayerCommands };
