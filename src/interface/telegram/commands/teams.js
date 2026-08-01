/**
 * src/interface/telegram/commands/teams.js — Comandos de equipos (Fase 7, Fase 3, batch B).
 *
 * Comandos que (a) delegan una frase NL al messageHandler legacy vía el gateway
 * `nlu`, enriqueciendo la respuesta con teclados/fotos, o (b) resuelven inline
 * contra `cache`. La lógica se relocaliza VERBATIM desde handleCommand (misma
 * extracción del equipo desde `ctx.text`, mismos textos, mismo orden de envío)
 * para preservar el comportamiento byte a byte. La presentación queda en el
 * command handler (orquestación de interface), que es el lugar correcto para
 * estos adaptadores sobre el messageHandler.
 */

const VS_RE = /^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i;

const STAT_ALIASES = [
  { cmd: '/goles', tipo: 'goles' },
  { cmd: '/corners', tipo: 'córners' },
  { cmd: '/posesion', tipo: 'posesión' },
  { cmd: '/posesión', tipo: 'posesión' },
  { cmd: '/tarjetas', tipo: 'tarjetas' },
  { cmd: '/goleador', tipo: 'goles' },
];

function registerTeamsCommands(router, deps) {
  const {
    nlu, cache, matchSearch, sendMessage, sendPhoto, sendMediaGroup,
    getTeamBadgeUrl, getCountryFlagUrl, buildGameKeyboard, buildSingleGameKeyboard,
  } = deps;

  // ---- /resultado [equipo | eq1 vs eq2] ----
  router.registerPrefix(['/resultado'], async (ctx) => {
    const chatId = ctx.chatId;
    const equipoText = ctx.text.replace('/resultado ', '').replace('/Resultado ', '');
    const vsMatch = equipoText.match(VS_RE);
    let photoUrls = null;
    let vsHomeName = null, vsAwayName = null;
    if (vsMatch) {
      vsHomeName = vsMatch[1].trim();
      vsAwayName = vsMatch[2].trim();
      const [homeTeam, awayTeam] = await Promise.all([
        cache.getTeamByName(vsHomeName),
        cache.getTeamByName(vsAwayName),
      ]);
      const homeBadge = homeTeam?.id ? getTeamBadgeUrl(homeTeam.id, homeTeam.imageVersion) : null;
      const awayBadge = awayTeam?.id ? getTeamBadgeUrl(awayTeam.id, awayTeam.imageVersion) : null;
      if (homeBadge && awayBadge) photoUrls = [homeBadge, awayBadge];
      else if (homeBadge) photoUrls = [homeBadge];
      else if (awayBadge) photoUrls = [awayBadge];
    } else {
      const team = await cache.getTeamByName(equipoText.trim());
      if (team?.id) photoUrls = [getTeamBadgeUrl(team.id, team.imageVersion)];
    }
    await nlu.delegate(chatId, `como quedo ${equipoText}`, async (t) => {
      if (photoUrls && photoUrls.length === 2) {
        await sendMediaGroup(chatId, photoUrls.map((u) => ({ type: 'photo', media: u })));
        await sendMessage(chatId, t);
      } else if (photoUrls && photoUrls.length === 1) {
        await sendPhoto(chatId, photoUrls[0], t);
      } else {
        await sendMessage(chatId, t);
      }
      if (vsHomeName && vsAwayName) {
        const game = await matchSearch.findGameByTeams(vsHomeName, vsAwayName).catch(() => null);
        if (game?.id) {
          await sendMessage(chatId, '📊 Acciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['tip', 'trends', 'odds']) } });
        }
      }
    });
  });

  // ---- /analizar (usage) + /analizar <eq1 vs eq2> ----
  router.register(['/analizar'], async (ctx) => {
    await sendMessage(ctx.chatId,
      `📊 *Analizar partido*\n\n` +
      `Uso: \`/analizar [equipo1] vs [equipo2]\`\n\n` +
      `Ejemplos:\n` +
      `• /analizar Brasil vs Francia\n` +
      `• /analizar Argentina vs Alemania\n\n` +
      `Genero estadísticas, forma reciente y pronóstico.`
    );
  });
  router.registerPrefix(['/analizar'], async (ctx) => {
    const chatId = ctx.chatId;
    const vsText = ctx.text.replace('/analizar ', '').replace('/Analizar ', '');
    const vsM = vsText.match(VS_RE);
    await nlu.delegate(chatId, `analiza ${vsText}`, async (t) => {
      await sendMessage(chatId, t);
      if (vsM) {
        const game = await matchSearch.findGameByTeams(vsM[1].trim(), vsM[2].trim()).catch(() => null);
        if (game?.id) {
          await sendMessage(chatId, '📊 Acciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['h2h', 'odds']) } });
        }
      }
    });
  });

  // ---- Aliases de stats: /goles /corners /posesion /tarjetas /goleador ----
  for (const alias of STAT_ALIASES) {
    router.register([alias.cmd], async (ctx) => {
      await sendMessage(ctx.chatId,
        `📊 *${alias.cmd.replace('/', '').toUpperCase()} [equipo]*\n\n` +
        `Uso: \`${alias.cmd} [equipo]\`\n\n` +
        `Ejemplos:\n` +
        `• ${alias.cmd} Brasil\n` +
        `• ${alias.cmd} Argentina\n\n` +
        `Te muestro ${alias.tipo} de los últimos partidos.`
      );
    });
    router.registerPrefix([alias.cmd], async (ctx) => {
      const equipo = ctx.text.replace(new RegExp(`^${alias.cmd}(?:@\\w+)? `, 'i'), '').trim();
      await nlu.delegate(ctx.chatId, `${alias.tipo} de ${equipo}`, async (t) => sendMessage(ctx.chatId, t));
    });
  }

  // ---- /racha (usage) + /racha <equipo> ----
  router.register(['/racha'], async (ctx) => {
    await sendMessage(ctx.chatId,
      `🔥 *RACHA [equipo]*\n\n` +
      `Uso: \`/racha [equipo]\`\n\n` +
      `Ejemplos:\n` +
      `• /racha Brasil\n` +
      `• /racha Argentina\n\n` +
      `Te muestro la racha actual (W = victorias, L = derrotas).`
    );
  });
  router.registerPrefix(['/racha'], async (ctx) => {
    const chatId = ctx.chatId;
    const equipo = ctx.text.replace(/^\/racha(?:@\w+)? /i, '').trim();
    const team = await cache.getTeamByName(equipo);
    const photoUrl = team?.id ? getTeamBadgeUrl(team.id, team.imageVersion) : null;
    await nlu.delegate(chatId, `cual es la racha de ${equipo}`, async (t) => {
      if (photoUrl) {
        await sendPhoto(chatId, photoUrl, t);
      } else {
        await sendMessage(chatId, t);
      }
    });
  });

  // ---- /proximos y /siguiente (usage) + <equipo> (inline) ----
  router.register(['/proximos', '/siguiente'], async (ctx) => {
    const cmd = ctx.cmd.replace(/@botmundialistabot\b/g, '');
    await sendMessage(ctx.chatId,
      `📅 *${cmd.startsWith('/siguiente') ? 'SIGUIENTE' : 'PRÓXIMOS'} [equipo]*\n\n` +
      `Uso: \`${cmd} [equipo]\`\n\n` +
      `• /proximos Brasil — Próximos 5 partidos\n` +
      `• /siguiente Argentina — Solo el siguiente partido`
    );
  });
  router.registerPrefix(['/proximos', '/siguiente'], async (ctx) => {
    const chatId = ctx.chatId;
    const cmd = ctx.cmd;
    const limit = cmd.startsWith('/siguiente') ? 1 : 5;
    const equipo = ctx.text.replace(/^\/(proximos|siguiente)(?:@\w+)? /i, '').trim();
    try {
      const team = await cache.getTeamByName(equipo);
      if (!team) {
        await sendMessage(chatId, `⚠️ No encontré al equipo "${equipo}".`);
        return;
      }
      const allMatches = await cache.getRecentWorldCupMatchesByTeam(team.id);
      const now = Date.now();
      const upcoming = allMatches
        .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
        .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
        .slice(0, limit);
      if (!upcoming || upcoming.length === 0) {
        await sendMessage(chatId, `📅 No hay partidos próximos para *${team.name}*.`);
        return;
      }
      let msg = `📅 *${cmd.startsWith('/siguiente') ? 'PRÓXIMO' : 'PRÓXIMOS'} PARTIDO${limit > 1 ? 'S' : ''} - ${team.name.toUpperCase()}*\n\n`;
      upcoming.forEach((m) => {
        const date = new Date(m.date).toLocaleDateString('es-ES', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        });
        const tournament = m.leagueName || m.tournament || 'Competición';
        const isHome = m.homeTeamId == team.id;
        msg += `📅 ${date}\n`;
        msg += `  ${m.homeTeam} vs ${m.awayTeam}\n`;
        msg += `  ${isHome ? '🟢 LOCAL' : '✈️ VISITANTE'} · 🏆 ${tournament}\n\n`;
      });
      const badgeUrl = team?.id ? getTeamBadgeUrl(team.id, team.imageVersion) : null;
      if (badgeUrl) {
        await sendPhoto(chatId, badgeUrl, `🏆 ${team.name}`);
      }
      await sendMessage(chatId, msg.trim());
      if (upcoming.length > 0) {
        await sendMessage(chatId, '🎲 Ver cuotas:', { reply_markup: { inline_keyboard: buildGameKeyboard(upcoming, ['odds']) } });
      }
    } catch (e) {
      await sendMessage(chatId, '⚠️ No pude obtener próximos partidos.');
    }
  });

  // ---- /dejarseguir (usage) + <equipo> ----
  router.register(['/dejarseguir'], async (ctx) => {
    await sendMessage(ctx.chatId,
      `🚫 *DEJAR DE SEGUIR [equipo]*\n\n` +
      `Uso: \`/dejarseguir [equipo]\`\n\n` +
      `• /dejarseguir Brasil\n` +
      `• /dejarseguir Argentina`
    );
  });
  router.registerPrefix(['/dejarseguir', '/dejar_seguir'], async (ctx) => {
    const chatId = ctx.chatId;
    const equipo = ctx.text.replace(/^\/(dejarseguir|dejar_seguir)(?:@\w+)? /i, '').trim();
    await nlu.delegate(chatId, `dejar de seguir ${equipo}`, async (t) => sendMessage(chatId, t));
  });

  // ---- /misfavoritos (+ aliases) ----
  router.register(['/misfavoritos', '/misequipos', '/misfavorito'], async (ctx) => {
    await nlu.delegate(ctx.chatId, 'mis equipos', async (t) => sendMessage(ctx.chatId, t));
  });

  // ---- /dondever (usage) + <equipo> (inline) ----
  router.register(['/dondever'], async (ctx) => {
    await sendMessage(ctx.chatId,
      `📺 *DÓNDE VER [equipo]*\n\n` +
      `Uso: \`/dondever [equipo]\`\n\n` +
      `Por ahora te muestro dónde se juega (estadio) el próximo partido.`
    );
  });
  router.registerPrefix(['/dondever'], async (ctx) => {
    const chatId = ctx.chatId;
    const equipo = ctx.text.replace(/^\/dondever(?:@\w+)? /i, '').trim();
    try {
      const team = await cache.getTeamByName(equipo);
      if (!team) {
        await sendMessage(chatId, `⚠️ No encontré al equipo "${equipo}".`);
        return;
      }
      const allMatches = await cache.getRecentWorldCupMatchesByTeam(team.id);
      const now = Date.now();
      const upcoming = allMatches
        .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
        .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
        .slice(0, 1);
      if (!upcoming || upcoming.length === 0) {
        await sendMessage(chatId, `📺 No hay partidos próximos de *${team.name}* para mostrar sede.`);
        return;
      }
      const m = upcoming[0];
      await sendMessage(chatId,
        `📺 *PRÓXIMO PARTIDO - ${team.name.toUpperCase()}*\n\n` +
        `${m.homeTeam} vs ${m.awayTeam}\n` +
        `📅 ${new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
        `🏆 ${m.leagueName || m.tournament || 'Competición'}\n\n` +
        `ℹ️ Los derechos de transmisión varían por país. Te sugiero consultar la guía de TV de tu país (ej: "TyC Sports" o "ESPN" en Argentina, "TUDN" en México, "Movistar+" en España).`
      );
      if (m.id) {
        await sendMessage(chatId, '🎲 Cuotas:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(m.id, ['odds']) } });
      }
    } catch (e) {
      await sendMessage(chatId, '⚠️ No pude obtener info.');
    }
  });

  // ---- /info <equipo> ----
  router.registerPrefix(['/info'], async (ctx) => {
    const chatId = ctx.chatId;
    const equipo = ctx.text.replace(/^\/info(?:@\w+)? /i, '').trim();
    const team = await cache.getTeamByName(equipo);
    let photoUrl = null;
    if (team && team.id) {
      photoUrl = getTeamBadgeUrl(team.id, team.imageVersion) || getCountryFlagUrl(team.countryId);
    } else if (team && team.countryId) {
      photoUrl = getCountryFlagUrl(team.countryId);
    }
    await nlu.delegate(chatId, `dame info de ${equipo}`, async (t) => {
      if (photoUrl) {
        await sendPhoto(chatId, photoUrl, t);
      } else {
        await sendMessage(chatId, t);
      }
      if (team?.id) {
        const allM = await cache.getRecentWorldCupMatchesByTeam(team.id).catch(() => []);
        const now = Date.now();
        const next = allM.filter((gm) => new Date(gm.startTime || gm.date || 0) > now).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)).slice(0, 1);
        if (next.length && next[0].id) {
          await sendMessage(chatId, '🎲 Cuotas del próximo partido:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(next[0].id, ['odds']) } });
        }
      }
    });
  });

  // ---- /seguir <equipo> ----
  router.registerPrefix(['/seguir'], async (ctx) => {
    const chatId = ctx.chatId;
    const equipo = ctx.text.replace('/seguir ', '').replace('/Seguir ', '');
    const team = await cache.getTeamByName(equipo).catch(() => null);
    await nlu.delegate(chatId, `seguir ${equipo}`, async (t) => {
      await sendMessage(chatId, t);
      if (team?.id) {
        const allM = await cache.getRecentWorldCupMatchesByTeam(team.id).catch(() => []);
        const now = Date.now();
        const next = allM.filter((gm) => new Date(gm.startTime || gm.date || 0) > now).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)).slice(0, 3);
        if (next.length) {
          await sendMessage(chatId, '🎲 Próximos partidos:', { reply_markup: { inline_keyboard: buildGameKeyboard(next, ['odds']) } });
        }
      }
    });
  });

  // ---- /grupo <letra> ----
  router.registerPrefix(['/grupo'], async (ctx) => {
    const chatId = ctx.chatId;
    const grupo = ctx.text.replace('/grupo ', '').replace('/Grupo ', '').toUpperCase();
    await nlu.delegate(chatId, `tabla grupo ${grupo}`, async (t) => sendMessage(chatId, t));
    try {
      const standings = await cache.getWorldCupStandings();
      const standing = standings.find((s) => {
        const letra = s.name?.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase();
        return letra === grupo;
      });
      if (standing?.teams?.length > 0) {
        const media = [];
        for (const t of standing.teams) {
          const team = await cache.getTeamByName(t.name);
          if (team?.id) {
            const url = getTeamBadgeUrl(team.id, team.imageVersion);
            if (url) media.push({ type: 'photo', media: url });
          }
        }
        if (media.length > 0) await sendMediaGroup(chatId, media);
      }
    } catch (e) { /* ignore badge errors */ }
  });
}

module.exports = { registerTeamsCommands };
