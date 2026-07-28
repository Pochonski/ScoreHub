// ScoreHub - Telegram Bot (usando API directa)
require('dotenv').config();
const { install: installProcessGuard } = require('./utils/processGuard');
installProcessGuard({ name: 'telegramBot' });
const messageHandler = require('./handlers/messageHandler');
const matchSearch = require('./services/matchSearch');
const scores365 = require('./services/scores365Service');
const followHandler = require('./handlers/followHandler');
const conversationalHandler = require('./handlers/conversationalHandler');
const mundialista365 = require('./handlers/mundialista365Handler');
const mundialistaStats = require('./handlers/mundialistaStatsHandler');
const cache = require('./services/mundialCache');
const matchHandler = require('./handlers/matchHandler');
const { getAthletePhotoUrl, getAthleteThumbUrl, getCountryFlagUrl, getTeamBadgeUrl } = require('./services/images');
const { pool, testConnection } = require('./database/connection');
const userStorage = require('./utils/userStorage');
const logger = require('./utils/logger');
const telegramNotifier = require('./services/telegramNotifier');
const conversationContext = require('./services/conversationContext');
// Capa interface extraída (Fase 7): transporte Telegram + HTTP server.
const { telegramRequest, sendMessage, sendPhoto, sendMediaGroup } = require('./src/interface/telegram/client');
const { createHttpServer } = require('./src/interface/http/server');
const { createLifecycle } = require('./src/interface/telegram/lifecycle');
const { createContainer } = require('./src/infrastructure/container');
const { buildGameKeyboard, buildSingleGameKeyboard } = require('./src/interface/telegram/presenters/keyboards');

if (process.env.ENABLE_LIVE_NOTIFIER === 'true') {
  try {
    telegramNotifier.registerBot({ sendMessage }, 'telegram');
    telegramNotifier.attach();
  } catch (e) {
    console.error('[telegramBot] error attaching notifier:', e.message);
  }
}

// Estado de la DB: lo publica el lifecycle (init) y lo lee el HTTP server.
// El wiring (lifecycle + HTTP server + arranque) vive en el composition root
// al final del archivo (Fase 7).
let dbAvailable = false;
const PORT = process.env.PORT || 8080;

/**
 * Maneja comandos de Telegram (que empiezan con /)
 */
async function handleCommand(chatId, text, userName, userId) {
  const cmd = text.toLowerCase();

  // Fase 7 (strangler): el router atiende los comandos ya migrados a la nueva
  // arquitectura (interface/telegram/commands → application → infrastructure).
  // Si ninguno matchea, cae al if-else legacy de abajo.
  if (await router.dispatch({ cmd, text, chatId, userName, userId })) return true;

  const storedAlias = userStorage.getAlias(userId);
  const alias = storedAlias || userName || 'Usuario';

  switch (cmd) {
    case '/start':
    case '/inicio':
      await sendMessage(chatId,
        `🏆 *ScoreHub* - Asistente de fútbol\n\n` +
        `¡Hola ${alias}! 👋 Soy tu asistente de fútbol.\n\n` +
        `📱 *Comandos básicos:*\n` +
        `  /start · /help - Iniciar / ver ayuda\n` +
        `  /partidos - Partidos de hoy\n` +
        `  /manana - Partidos de mañana\n` +
        `  /tabla - Tabla del Mundial\n` +
        `  /grupo [A-L] - Tabla de grupo _(ej: /grupo A)_\n` +
        `  /resultado [equipo] - Resultado _(ej: /resultado brasil)_\n` +
        `  /analizar [eq1] vs [eq2] - Análisis _(ej: /analizar brasil vs argentina)_\n` +
        `  /info [equipo] · /seguir [equipo] - Info / seguir equipo\n` +
        `  /cambiarusuario [nombre] - Cambiar apodo\n\n` +
        `🎯 *Tips, cuotas y tendencias:*\n` +
        `  /fixture - Próximos partidos del Mundial\n` +
        `  /outrights - Cuotas de campeón, goleador y más\n` +
        `  /odds <gameId> - Cuotas detalladas de un partido\n` +
        `  /tip [eq1] vs [eq2] - Tip con confianza _(ej: /tip brasil vs argentina)_\n` +
        `  /tendencias - Top tendencias + cuotas del Mundial\n` +
        `  /tendencias [eq1] vs [eq2] - Trends de un partido\n` +
        `  /predicciones <gameId> - Predicciones de la comunidad\n\n` +
        `📡 *Stats y partidos:*\n` +
        `  /partidos - Partidos de hoy (tips + trends + odds)\n` +
        `  /live - Partidos en vivo con stats y odds\n` +
        `  /stats-vivo <gameId> - Stats del último snapshot\n` +
        `  /alineacion <gameId> - Titulares y formación\n` +
        `  /previa <gameId> - Pre-match stats\n` +
        `  /h2h <gameId> - Historial entre los equipos\n\n` +
        `📰 *Contenido del Mundial:*\n` +
        `  /noticias - Últimas noticias\n` +
        `  /noticias [equipo] - Noticias de un equipo _(ej: /noticias brasil)_\n` +
        `  /equipoideal - Team of the Week\n` +
        `  /bracket - Llaves eliminatorias\n` +
        `  /bracket grupos - Fase de grupos\n` +
        `  /historial - Campeones 1930-2022\n` +
        `  /historial 2022 - Final de ese año\n` +
        `  /historial brasil - Ediciones del equipo\n` +
        `  /goleadores - Top goleadores (con foto)\n` +
        `  /jugador <nombre> - Foto + info del jugador\n\n` +
        `💡 También podés escribir en lenguaje natural:\n` +
        `  "¿Cómo quedó Brasil?"\n` +
        `  "Tabla del grupo C"\n` +
        `  "Dame info de Alemania"`
      );
      return true;

    case '/cambiarnombre':
    case '/cambiarnombre@botmundialistabot':
    case '/cambiarusuario':
    case '/cambiarusuario@botmundialistabot':
      const argNombre = text.replace(/^\/(cambiarnombre|cambiarusuario)(@\w+)?/i, '').trim();
      if (!argNombre) {
        await sendMessage(chatId,
          `✏️ *Cambiar nombre*\n\n` +
          `Uso: \`/cambiarusuario TuNombre\`\n\n` +
          `Tu apodo actual: *${alias}*\n` +
          `Máximo ${userStorage.MAX_LEN} caracteres.\n\n` +
          `Otros comandos: /mialias (ver) · /help (ayuda)`
        );
        return true;
      }
      const r = await userStorage.setAlias(userId, argNombre);
      if (!r.ok) {
        await sendMessage(chatId, `⚠️ No pude cambiar tu nombre: ${r.reason}`);
      } else {
        const syncMsg = r.synced
          ? '✅ Guardado en Supabase'
          : '💾 Guardado localmente (Supabase no disponible)';
        await sendMessage(chatId,
          `✅ *Listo*\n\n` +
          `Tu nuevo apodo es: *${r.alias}*\n` +
          `${syncMsg}\n\n` +
          `A partir de ahora te saludaré como "${r.alias}".`
        );
      }
      return true;

    case '/mialias':
      const currentAlias = userStorage.getAlias(userId);
      if (currentAlias) {
        await sendMessage(chatId,
          `👤 *Tu apodo actual*\n\n` +
          `Apodo: *${currentAlias}*\n` +
          `ID de Telegram: \`${userId}\`\n\n` +
          `Para cambiarlo: \`/cambiarnombre NuevoNombre\``
        );
      } else {
        await sendMessage(chatId,
          `👤 Aún no tienes apodo personalizado.\n\n` +
          `Tu nombre actual es: *${userName || 'Usuario'}* (de Telegram)\n\n` +
          `Para crear uno: \`/cambiarnombre TuNombre\``
        );
      }
      return true;

    case '/partidos':
    case '/hoy': {
      try {
        const text = await matchHandler.getPartidosHoy();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).replace(/-/g, '');
        const games = await cache.getWorldCupGames({ date: today });
        if (games && games.length > 0) {
          const keyboard = buildGameKeyboard(games, ['tip', 'trends', 'odds']);
          await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
        } else {
          await sendMessage(chatId, text);
        }
      } catch (e) {
        console.error('[partidos] error:', e);
        await sendMessage(chatId, '⚠️ Error al obtener los partidos.');
      }
      return true;
    }

    case '/manana':
    case '/mañana':
    case '/tomorrow': {
      const hoyCR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
      const [y, m, d] = hoyCR.split('-').map(Number);
      const tomorrow = new Date(y, m - 1, d + 1).toISOString().split('T')[0].replace(/-/g, '');
      try {
        const matches = await cache.getWorldCupGames({ date: tomorrow });
        if (!matches || matches.length === 0) {
          await sendMessage(chatId,
            `📅 *MUNDIAL — MAÑANA*\n\n🟢 No hay partidos del Mundial programados para mañana.`);
          return true;
        }
        const porGrupo = {};
        matches.forEach(m => {
          const letra = (m.stageName || '').match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() || '?';
          if (!porGrupo[letra]) porGrupo[letra] = [];
          porGrupo[letra].push(m);
        });
        let msg = `📅 *MUNDIAL — MAÑANA*\n\n`;
        Object.keys(porGrupo).sort().forEach(g => {
          msg += `📋 *GRUPO ${g}*\n`;
          porGrupo[g].forEach(m => {
            const home = m.homeCompetitor?.name || m.homeTeam || '?';
            const away = m.awayCompetitor?.name || m.awayTeam || '?';
            msg += `⚽ ${home} vs ${away}`;
            const t = m.startTime || m.time || '';
            if (t) msg += `  _(${t.includes('T') ? t.split('T')[1]?.slice(0,5) : t})_`;
            msg += '\n';
          });
          msg += '\n';
        });
        const keyboard = buildGameKeyboard(matches, ['tip', 'trends', 'odds']);
        await sendMessage(chatId, msg.trim(), { reply_markup: { inline_keyboard: keyboard } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ No pude obtener partidos de mañana.');
      }
      return true;
    }

    case '/tabla':
    case '/clasificacion':
      const msgTabla = {
        from: chatId.toString(),
        body: 'tabla del mundial',
        hasMedia: false,
        reply: async (text) => await sendMessage(chatId, text)
      };
      await messageHandler(null, msgTabla);
      return true;

    case '/mundial': {
      await sendMessage(chatId,
        `🏆 *COMPETICIÓN*\n\n` +
        `🌎 *Sede:* EE.UU. · Canadá · México\n` +
        `📅 *Fechas:* 11 junio – 19 julio 2026\n` +
        `👥 *Equipos:* 48 selecciones\n` +
        `🗂 *Grupos:* 12 (A a L)\n` +
        `⚽ *Partidos:* 104 (64 fase grupos + 32 eliminación + 8 clasificación)\n` +
        `🥇 *Final:* 19 jul 2026 — MetLife Stadium, NJ\n\n` +
        `📋 *Comandos relacionados:*\n` +
        `• /grupo [A-L] — Tabla de un grupo\n` +
        `• /partidos — Partidos de hoy\n` +
        `• /manana — Partidos de mañana\n` +
        `• /goleadores — Top goleadores`
      );
      return true;
    }

    case '/yo':
    case '/perfil':
    case '/profile':
      try {
        const alias = userStorage.getAlias(userId);
        let followedCount = 0;
        let queryCount = 0;
        try {
          const f = await pool.query(
            `SELECT COUNT(*) FROM equipos_seguidos WHERE id_usuario = $1`,
            [userId]
          );
          followedCount = parseInt(f.rows[0]?.count || 0, 10);
          const h = await pool.query(
            `SELECT COUNT(*) FROM historial_consultas WHERE id_usuario = $1`,
            [userId]
          );
          queryCount = parseInt(h.rows[0]?.count || 0, 10);
        } catch (e) { /* DB opcional */ }
        await sendMessage(chatId,
          `👤 *TU PERFIL*\n\n` +
          `🏷  *Apodo:* ${alias || userName || 'Sin definir'}\n` +
          `🆔 *ID:* \`${userId}\`\n` +
          `⭐ *Equipos seguidos:* ${followedCount}\n` +
          `💬 *Consultas realizadas:* ${queryCount}\n\n` +
          `📋 *Comandos útiles:*\n` +
          `• /misfavoritos — Ver equipos seguidos\n` +
          `• /cambiarusuario [nombre] — Cambiar apodo\n` +
          `• /reset — Borrar todos mis datos`
        );
      } catch (e) {
        await sendMessage(chatId, '⚠️ No pude cargar tu perfil.');
      }
      return true;

    case '/reset': {
      await sendMessage(chatId,
        `⚠️ *Borrar todos mis datos*\n\n` +
        `Esto eliminará:\n` +
        `• Tu apodo personalizado\n` +
        `• Todos los equipos que sigues\n` +
        `• Tu historial de consultas\n\n` +
        `Para confirmar, escribí: *BORRAR TODO*\n` +
        `Para cancelar, enviá cualquier otro mensaje.`);
      userStorage.markPendingReset(userId);
      return true;
    }

    default:
      // Comandos con argumentos: /resultado, /analizar, /info, /seguir
      if (cmd.startsWith('/resultado ')) {
        const equipoText = text.replace('/resultado ', '').replace('/Resultado ', '');
        const vsMatch = equipoText.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        let photoUrls = null;
        let vsHomeName = null, vsAwayName = null;
        if (vsMatch) {
          vsHomeName = vsMatch[1].trim();
          vsAwayName = vsMatch[2].trim();
          const [homeTeam, awayTeam] = await Promise.all([
            cache.getTeamByName(vsHomeName),
            cache.getTeamByName(vsAwayName)
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
        const msgRes = {
          from: chatId.toString(),
          body: `como quedo ${equipoText}`,
          hasMedia: false,
          reply: async (t) => {
            if (photoUrls && photoUrls.length === 2) {
              await sendMediaGroup(chatId, photoUrls.map(u => ({ type: 'photo', media: u })));
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
          }
        };
        await messageHandler(null, msgRes);
        return true;
      }

      if (cmd === '/analizar' || cmd === '/analizar@botmundialistabot') {
        await sendMessage(chatId,
          `📊 *Analizar partido*\n\n` +
          `Uso: \`/analizar [equipo1] vs [equipo2]\`\n\n` +
          `Ejemplos:\n` +
          `• /analizar Brasil vs Francia\n` +
          `• /analizar Argentina vs Alemania\n\n` +
          `Genero estadísticas, forma reciente y pronóstico.`
        );
        return true;
      }

      if (cmd.startsWith('/analizar ')) {
        const vsText = text.replace('/analizar ', '').replace('/Analizar ', '');
        const vsM = vsText.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        const msgAna = {
          from: chatId.toString(),
          body: `analiza ${vsText}`,
          hasMedia: false,
          reply: async (t) => {
            await sendMessage(chatId, t);
            if (vsM) {
              const game = await matchSearch.findGameByTeams(vsM[1].trim(), vsM[2].trim()).catch(() => null);
              if (game?.id) {
                await sendMessage(chatId, '📊 Acciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['h2h', 'odds']) } });
              }
            }
          }
        };
        await messageHandler(null, msgAna);
        return true;
      }

      // Aliases de stats: /goles, /corners, /posesion, /tarjetas
      const statAliases = [
        { cmd: '/goles', tipo: 'goles' },
        { cmd: '/corners', tipo: 'córners' },
        { cmd: '/posesion', tipo: 'posesión' },
        { cmd: '/posesión', tipo: 'posesión' },
        { cmd: '/tarjetas', tipo: 'tarjetas' },
        { cmd: '/goleador', tipo: 'goles' },
      ];
      for (const alias of statAliases) {
        if (cmd === alias.cmd || cmd === alias.cmd + '@botmundialistabot') {
          await sendMessage(chatId,
            `📊 *${alias.cmd.replace('/', '').toUpperCase()} [equipo]*\n\n` +
            `Uso: \`${alias.cmd} [equipo]\`\n\n` +
            `Ejemplos:\n` +
            `• ${alias.cmd} Brasil\n` +
            `• ${alias.cmd} Argentina\n\n` +
            `Te muestro ${alias.tipo} de los últimos partidos.`
          );
          return true;
        }
        if (cmd.startsWith(alias.cmd + ' ')) {
          const equipo = text.replace(new RegExp(`^${alias.cmd}(?:@\\w+)? `, 'i'), '').trim();
          const msgStat = {
            from: chatId.toString(),
            body: `${alias.tipo} de ${equipo}`,
            hasMedia: false,
            reply: async (t) => await sendMessage(chatId, t)
          };
          await messageHandler(null, msgStat);
          return true;
        }
      }

      // /racha [equipo] → muestra racha W/L y forma
      if (cmd === '/racha' || cmd === '/racha@botmundialistabot') {
        await sendMessage(chatId,
          `🔥 *RACHA [equipo]*\n\n` +
          `Uso: \`/racha [equipo]\`\n\n` +
          `Ejemplos:\n` +
          `• /racha Brasil\n` +
          `• /racha Argentina\n\n` +
          `Te muestro la racha actual (W = victorias, L = derrotas).`
        );
        return true;
      }
      if (cmd.startsWith('/racha ')) {
        const equipo = text.replace(/^\/racha(?:@\w+)? /i, '').trim();
        const team = await cache.getTeamByName(equipo);
        const photoUrl = team?.id ? getTeamBadgeUrl(team.id, team.imageVersion) : null;
        const msgSt = {
          from: chatId.toString(),
          body: `cual es la racha de ${equipo}`,
          hasMedia: false,
          reply: async (t) => {
            if (photoUrl) {
              await sendPhoto(chatId, photoUrl, t);
            } else {
              await sendMessage(chatId, t);
            }
          }
        };
        await messageHandler(null, msgSt);
        return true;
      }

      // /proximos [equipo] y /siguiente [equipo]
      if (cmd === '/proximos' || cmd === '/siguiente' ||
          cmd === '/proximos@botmundialistabot' || cmd === '/siguiente@botmundialistabot') {
        await sendMessage(chatId,
          `📅 *${cmd.startsWith('/siguiente') ? 'SIGUIENTE' : 'PRÓXIMOS'} [equipo]*\n\n` +
          `Uso: \`${cmd} [equipo]\`\n\n` +
          `• /proximos Brasil — Próximos 5 partidos\n` +
          `• /siguiente Argentina — Solo el siguiente partido`
        );
        return true;
      }
      if (cmd.startsWith('/proximos ') || cmd.startsWith('/siguiente ')) {
        const limit = cmd.startsWith('/siguiente') ? 1 : 5;
        const equipo = text.replace(/^\/(proximos|siguiente)(?:@\w+)? /i, '').trim();
        try {
          const team = await cache.getTeamByName(equipo);
          if (!team) {
            await sendMessage(chatId, `⚠️ No encontré al equipo "${equipo}".`);
            return true;
          }
          const allMatches = await cache.getRecentWorldCupMatchesByTeam(team.id);
          const now = Date.now();
          const upcoming = allMatches
            .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
            .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
            .slice(0, limit);
          if (!upcoming || upcoming.length === 0) {
            await sendMessage(chatId, `📅 No hay partidos próximos para *${team.name}*.`);
            return true;
          }
          let msg = `📅 *${cmd.startsWith('/siguiente') ? 'PRÓXIMO' : 'PRÓXIMOS'} PARTIDO${limit > 1 ? 'S' : ''} - ${team.name.toUpperCase()}*\n\n`;
          upcoming.forEach(m => {
            const date = new Date(m.date).toLocaleDateString('es-ES', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
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
        return true;
      }

      // /dejarseguir [equipo]
      if (cmd === '/dejarseguir' || cmd === '/dejarseguir@botmundialistabot') {
        await sendMessage(chatId,
          `🚫 *DEJAR DE SEGUIR [equipo]*\n\n` +
          `Uso: \`/dejarseguir [equipo]\`\n\n` +
          `• /dejarseguir Brasil\n` +
          `• /dejarseguir Argentina`
        );
        return true;
      }
      if (cmd.startsWith('/dejarseguir ') || cmd.startsWith('/dejar_seguir ')) {
        const equipo = text.replace(/^\/(dejarseguir|dejar_seguir)(?:@\w+)? /i, '').trim();
        const msgNoSeg = {
          from: chatId.toString(),
          body: `dejar de seguir ${equipo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgNoSeg);
        return true;
      }
      // Sin argumentos especiales: enviar el mensaje al messageHandler como texto
      if (/^\/dejarseguir(?:@\w+)?$/i.test(cmd)) {
        await sendMessage(chatId,
          `🚫 *DEJAR DE SEGUIR [equipo]*\n\nUso: \`/dejarseguir [equipo]\``
        );
        return true;
      }

      // /misfavoritos, /misequipos, /misfavorito
      if (cmd === '/misfavoritos' || cmd === '/misequipos' || cmd === '/misfavorito' ||
          cmd === '/misfavoritos@botmundialistabot') {
        const msgList = {
          from: chatId.toString(),
          body: 'mis equipos',
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgList);
        return true;
      }

      // /dondever [equipo]
      if (cmd === '/dondever' || cmd === '/dondever@botmundialistabot') {
        await sendMessage(chatId,
          `📺 *DÓNDE VER [equipo]*\n\n` +
          `Uso: \`/dondever [equipo]\`\n\n` +
          `Por ahora te muestro dónde se juega (estadio) el próximo partido.`
        );
        return true;
      }
      if (cmd.startsWith('/dondever ')) {
        const equipo = text.replace(/^\/dondever(?:@\w+)? /i, '').trim();
        try {
          const team = await cache.getTeamByName(equipo);
          if (!team) {
            await sendMessage(chatId, `⚠️ No encontré al equipo "${equipo}".`);
            return true;
          }
          const allMatches = await cache.getRecentWorldCupMatchesByTeam(team.id);
          const now = Date.now();
          const upcoming = allMatches
            .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
            .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
            .slice(0, 1);
          if (!upcoming || upcoming.length === 0) {
            await sendMessage(chatId, `📺 No hay partidos próximos de *${team.name}* para mostrar sede.`);
            return true;
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
        return true;
      }

      if (cmd.startsWith('/info ')) {
        const equipo = text.replace(/^\/info(?:@\w+)? /i, '').trim();
        const team = await cache.getTeamByName(equipo);
        let photoUrl = null;
        if (team && team.id) {
          photoUrl = getTeamBadgeUrl(team.id, team.imageVersion) || getCountryFlagUrl(team.countryId);
        } else if (team && team.countryId) {
          photoUrl = getCountryFlagUrl(team.countryId);
        }
        const msgInfo = {
          from: chatId.toString(),
          body: `dame info de ${equipo}`,
          hasMedia: false,
          reply: async (t) => {
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
          }
        };
        await messageHandler(null, msgInfo);
        return true;
      }

      if (cmd.startsWith('/seguir ')) {
        const equipo = text.replace('/seguir ', '').replace('/Seguir ', '');
        const team = await cache.getTeamByName(equipo).catch(() => null);
        const msgSeg = {
          from: chatId.toString(),
          body: `seguir ${equipo}`,
          hasMedia: false,
          reply: async (t) => {
            await sendMessage(chatId, t);
            if (team?.id) {
              const allM = await cache.getRecentWorldCupMatchesByTeam(team.id).catch(() => []);
              const now = Date.now();
              const next = allM.filter((gm) => new Date(gm.startTime || gm.date || 0) > now).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)).slice(0, 3);
              if (next.length) {
                await sendMessage(chatId, '🎲 Próximos partidos:', { reply_markup: { inline_keyboard: buildGameKeyboard(next, ['odds']) } });
              }
            }
          }
        };
        await messageHandler(null, msgSeg);
        return true;
      }

      if (cmd.startsWith('/grupo ')) {
        const grupo = text.replace('/grupo ', '').replace('/Grupo ', '').toUpperCase();
        const msgGrupo = {
          from: chatId.toString(),
          body: `tabla grupo ${grupo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgGrupo);
        try {
          const standings = await cache.getWorldCupStandings();
          const standing = standings.find(s => {
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
        return true;
      }

      // ===========================================================
      // FASE 1.5: Fixtures y Outrights
      // ===========================================================

      // /fixture: migrado al router (Fase 7 — interface/telegram/commands/fixture.js).

      // /outrights — cuotas de campeón, goleador, etc.
      // /outrights: migrado al router (Fase 7 — commands/matchDetail.js).

      // ===========================================================
      // FASE 2: Tips y Tendencias (365scores via Cosmos)
      // ===========================================================

      // /live: migrado al router (Fase 7 — interface/telegram/commands/live.js).

      // /tip — puede ser con args (eq1 vs eq2) o sin args (prompt de uso)
      if (cmd === '/tip' || cmd === '/tip@botmundialistabot') {
        await sendMessage(chatId,
          `🎯 *TIP DE PARTIDO*\n\n` +
          `Uso: \`/tip [equipo1] vs [equipo2]\`\n\n` +
          `Ejemplos:\n` +
          `• /tip brasil vs argentina\n` +
          `• /tip francia vs alemania\n\n` +
          `💡 El tip se calcula con base en las tendencias de los partidos (365scores). ` +
          `Para más detalles: \`/tendencias brasil vs argentina\` o \`/stats-vivo <gameId>\` (si lo conocés).`
        );
        return true;
      }
      if (cmd.startsWith('/tip ')) {
        const args = text.replace(/^\/tip(?:@\w+)?\s+/i, '').trim();
        const m = args.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        if (!m) {
          await sendMessage(chatId,
            `⚠️ Formato: \`/tip [equipo1] vs [equipo2]\`\n\n` +
            `Ejemplo: \`/tip brasil vs argentina\``
          );
          return true;
        }
        const home = m[1].trim();
        const away = m[2].trim();
        const t = await mundialista365.getTipPartido(home, away);
        await sendMessage(chatId, t);
        const game = await matchSearch.findGameByTeams(home, away).catch(() => null);
        if (game?.id) {
          await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['trends', 'odds']) } });
        }
        return true;
      }

      // /tendencias — top Mundial o por equipos (eq1 vs eq2)
      if (cmd === '/tendencias' || cmd === '/tendencias@botmundialistabot' || cmd === '/trends' || cmd === '/trends@botmundialistabot') {
        const t = await mundialista365.getTendencias('competition', null, 10);
        const o = await mundialista365.getOutrights();
        await sendMessage(chatId, t + '\n\n━━━━━━━━━━━━━━━━\n' + o);
        return true;
      }
      if (cmd.startsWith('/tendencias ') || cmd.startsWith('/trends ')) {
        const arg = text.replace(/^\/(tendencias|trends)(?:@\w+)?\s+/i, '').trim();
        if (!arg) {
          const t = await mundialista365.getTendencias('competition', null, 10);
          await sendMessage(chatId, t);
          return true;
        }
        // Modo: "eq1 vs eq2" → resuelve partido y devuelve sus trends
        const m = arg.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        if (m) {
          const t = await mundialista365.getTendenciasByTeams(m[1].trim(), m[2].trim(), 10);
          await sendMessage(chatId, t);
          const game = await matchSearch.findGameByTeams(m[1].trim(), m[2].trim()).catch(() => null);
          if (game?.id) {
            await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['tip', 'odds']) } });
          }
          return true;
        }
        // Fallback: usage
        await sendMessage(chatId,
          `📊 *TENDENCIAS*\n\n` +
          `Uso:\n` +
          `  \`/tendencias\` — Top Mundial\n` +
          `  \`/tendencias brasil vs argentina\` — Trends del partido\n\n` +
          `💡 Para stats en vivo de un partido, usá los nombres con /tip, /stats-vivo o /alineacion.`
        );
        return true;
      }

      // /predicciones <gameId>
      // /predicciones: migrado al router (Fase 7 — commands/matchDetail.js).

      // ===========================================================
      // FASE 4: Stats en vivo y alineaciones (365scores via Cosmos)
      // ===========================================================

      // /stats-vivo, /odds: migrados al router (Fase 7 — commands/matchDetail.js).

      // /alineacion [gameId | eq1 vs eq2] — titulares y formación + fotos de jugadores
      const alineacionRe = /^\/(alineaci[oó]n|lineup|titulares)(?:@\w+)?/i;
      if (alineacionRe.test(cmd) && !text.includes(' ')) {
        await sendMessage(chatId,
          `👥 *ALINEACIONES*\n\n` +
          `Uso: \`/alineacion <gameId>\` o \`/alineacion <eq1> vs <eq2>\`\n\n` +
          `Ejemplos:\n` +
          `• /alineacion 4749268\n` +
          `• /alineacion brasil vs argentina\n\n` +
          `💡 Las alineaciones se publican cerca del kickoff.`
        );
        return true;
      }
      if (alineacionRe.test(cmd) && text.includes(' ')) {
        const arg = text.replace(alineacionRe, '').trim();
        let gameId = arg;
        const isGameId = /^\d+$/.test(arg);

        if (!isGameId) {
          try {
            const vsMatch = arg.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
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
            return true;
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
        squadMembers.forEach(m => { if (m.id != null) memberMap[m.id] = m; });

        try {
          const sides = [
            { comp: homeComp, label: 'home' },
            { comp: awayComp, label: 'away' }
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
              const media = members.map(m => {
                const info = memberMap[m.id];
                return {
                  type: 'photo',
                  media: getAthleteThumbUrl(info?.athleteId || m.athleteId, info?.imageVersion || m.imageVersion),
                  caption: info?.shortName || info?.name || m.shortName || m.name || '?'
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
        return true;
      }

      // /previa <gameId> — pre-match stats
      // /previa: migrado al router (Fase 7 — commands/matchDetail.js).

      // ===========================================================
      // TIER 1: Contenido del Mundial (365scores via Cosmos)
      // ===========================================================

      // /noticias [equipo]
      if (cmd === '/noticias' || cmd === '/noticias@botmundialistabot') {
        const t = await mundialistaStats.getNoticias({ equipo: null, limit: 10 });
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd.startsWith('/noticias ') || cmd.startsWith('/noticias@botmundialistabot ')) {
        const arg = text.replace(/^\/noticias(?:@\w+)?\s+/i, '').trim();
        const t = await mundialistaStats.getNoticias({ equipo: arg, limit: 10 });
        await sendMessage(chatId, t);
        return true;
      }

      // /equipoideal /idealtm /tow
      if (cmd === '/equipoideal' || cmd === '/equipoideal@botmundialistabot' ||
          cmd === '/idealtm' || cmd === '/idealtm@botmundialistabot' ||
          cmd === '/tow' || cmd === '/tow@botmundialistabot') {
        const t = await mundialistaStats.getEquipoIdeal();
        await sendMessage(chatId, t);
        return true;
      }

      // /bracket [grupos|eliminatorias|todo]  /llaves
      if (cmd === '/bracket' || cmd === '/bracket@botmundialistabot' ||
          cmd === '/llaves' || cmd === '/llaves@botmundialistabot') {
        const t = await mundialistaStats.getBracket('eliminatorias');
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd === '/bracket grupos' || cmd === '/bracket@botmundialistabot grupos' ||
          cmd === '/llaves grupos' || cmd === '/llaves@botmundialistabot grupos') {
        const t = await mundialistaStats.getBracket('grupos');
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd === '/bracket todo' || cmd === '/bracket@botmundialistabot todo' ||
          cmd === '/bracket completo' || cmd === '/bracket@botmundialistabot completo') {
        const t = await mundialistaStats.getBracket('todo');
        await sendMessage(chatId, t);
        return true;
      }

      // /historial [año|equipo]
      if (cmd === '/historial' || cmd === '/historial@botmundialistabot') {
        const t = await mundialistaStats.getHistorial(null);
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd.startsWith('/historial ') || cmd.startsWith('/historial@botmundialistabot ')) {
        const arg = text.replace(/^\/historial(?:@\w+)?\s+/i, '').trim();
        const t = await mundialistaStats.getHistorial(arg);
        await sendMessage(chatId, t);
        return true;
      }

      // /goleadores /rankinggoleador /topgoleador
      if (cmd === '/goleadores' || cmd === '/goleadores@botmundialistabot' ||
          cmd === '/rankinggoleador' || cmd === '/rankinggoleador@botmundialistabot' ||
          cmd === '/topgoleador' || cmd === '/topgoleador@botmundialistabot') {
        const t = await mundialistaStats.getGoleadores(10);
        if (t.photoUrl) {
          await sendPhoto(chatId, t.photoUrl, t.text);
        } else {
          await sendMessage(chatId, t.text);
        }
        const o = await mundialista365.getOutrights().catch(() => null);
        if (o) await sendMessage(chatId, o);
        return true;
      }

      // /jugador <nombre> — foto + info del jugador
      if (cmd.startsWith('/jugador') || cmd.startsWith('/jugador@botmundialistabot ')) {
        const name = text.replace(/^\/(jugador|buscar)(?:@\w+)?\s+/i, '').trim();
        if (!name) {
          await sendMessage(chatId, '📖 Uso: `/jugador <nombre>` — ej: `/jugador mbappe`');
          return true;
        }
        const matches = await cache.searchAthletes(name);
        if (!matches || !matches.length) {
          await sendMessage(chatId, `⚠️ No encontré al jugador "${name}".`);
          return true;
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
        return true;
      }

      // /h2h <gameId> — historial entre equipos
      // /h2h: migrado al router (Fase 7 — commands/matchDetail.js).

      return false;
  }
}

/**
 * Guarda consulta en historial_consultas (solo si DB disponible)
 */
async function saveHistory(userId, text, tipo, response) {
  if (!dbAvailable) return;
  try {
    await pool.query(
      'INSERT INTO historial_consultas (id_usuario, consulta, tipo, respuesta, fecha) VALUES ($1, $2, $3, $4, NOW())',
      [String(userId), text, tipo || 'comando', response || '']
    );
  } catch (e) {
    console.error('[saveHistory] error:', e.message);
  }
}

/**
 * Procesa un mensaje de Telegram (comando o chat)
 */
async function processMessage(chatId, userId, text, user) {
  console.log(`📩 Telegram: [${user}] (${userId}) ${text}`);

  if (text.startsWith('/')) {
    const lowerText = text.toLowerCase();
    const botSuffix = '@botmundialistabot';
    const cleaned = lowerText.split(' ')[0].split('@')[0];

    if (cleaned === '/follow') {
      const args = text.replace(/^\/[a-z@0-9_]+/i, '').trim();
      const result = await followHandler.handleFollowCommand(String(userId), args);
      await sendMessage(chatId, result.message);
      return;
    }
    if (cleaned === '/unfollow' || cleaned === '/dejarseguir') {
      const args = text.replace(/^\/[a-z@0-9_]+/i, '').trim();
      const result = await followHandler.handleUnfollowCommand(String(userId), args);
      await sendMessage(chatId, result.message);
      return;
    }
    if (cleaned === '/misapuestas' || cleaned === '/siguiendo' || cleaned === '/siguiendo@botmundialistabot') {
      const result = await followHandler.handleListCommand(String(userId));
      await sendMessage(chatId, result.message);
      return;
    }

    let handled = false;
    try {
      handled = await handleCommand(chatId, text, user, String(userId));
    } catch (e) {
      console.error(`[telegramBot] handleCommand error:`, e.stack || e.message);
      await sendMessage(chatId, `❌ Error procesando el comando: ${e.message}`);
      return;
    }
    if (handled) {
      const tipo = cleaned === '/start' ? 'inicio' : cleaned.replace('/', '').split(' ')[0];
      saveHistory(String(userId), text, tipo, '');
      return;
    }
    const textSinComando = text.replace(/^\/[a-z@0-9_]+\s*/i, '').trim();
    if (textSinComando) {
      const msgObj = {
        from: chatId.toString(),
        body: textSinComando,
        hasMedia: false,
        reply: async (t) => await sendMessage(chatId, t)
      };
      await messageHandler(null, msgObj);
      return;
    }
  } else {
    try {
      const result = await conversationalHandler.handleMessage(String(userId), text);
      if (result.handled && result.message) {
        await sendMessage(chatId, result.message);
        saveHistory(String(userId), text, 'conversacion', result.message);
        return;
      }
    } catch (e) {
      console.error('[telegramBot] conversationalHandler error:', e.message);
    }
  }

  try {
    const messageObj = {
      from: chatId.toString(),
      body: text,
      hasMedia: false,
      reply: async (responseText) => {
        await sendMessage(chatId, responseText);
      }
    };
    await messageHandler(null, messageObj);
  } catch (error) {
    console.error('Error procesando mensaje Telegram:', error);
    await sendMessage(chatId, '⚠️ Ocurrió un error. Intenta de nuevo.');
  }
}


/**
 * Maneja callback queries del teclado inline de partidos
 */
async function handlePartidosCallback(chatId, callbackData) {
  const idx = callbackData.indexOf('_');
  if (idx === -1) {
    await sendMessage(chatId, '⚠️ Acción no válida.');
    return;
  }
  const action = callbackData.substring(0, idx);
  const gameId = callbackData.substring(idx + 1);

  const handlers = {
    tip: async () => {
      try {
        const game = await cache.getGameById(gameId);
        if (game?.homeCompetitor?.name && game?.awayCompetitor?.name) {
          const tip = await mundialista365.formatTipForGame(game);
          if (tip) {
            await sendMessage(chatId, tip);
            if (gameId) {
              await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['trends', 'odds']) } });
            }
          } else {
            await sendMessage(chatId, '⚠️ No hay tip disponible para ese partido.');
          }
        } else {
          await sendMessage(chatId, '⚠️ No pude obtener información de ese partido.');
        }
      } catch (e) {
        console.error('[callback tip] error:', e.message);
        await sendMessage(chatId, '⚠️ Error al obtener tip de ese partido.');
      }
    },
    trends: async () => {
      try {
        const t = await mundialista365.getTendencias('game', gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['tip', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener tendencias.');
      }
    },
    odds: async () => {
      try {
        const t = await mundialista365.getOdds(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['tip', 'trends']) } });
      } catch (e) {
        console.error('[callback odds] error:', e);
        await sendMessage(chatId, '⚠️ Error al obtener cuotas.');
      }
    },
    h2h: async () => {
      try {
        const t = await mundialista365.getH2H(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['previa', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener historial.');
      }
    },
    previa: async () => {
      try {
        const t = await mundialista365.getPrevia(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['lineup', 'h2h', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener previa.');
      }
    },
    lineup: async () => {
      try {
        const t = await mundialista365.getAlineacion(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['previa', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener alineación.');
      }
    },
    stats: async () => {
      try {
        const t = await mundialista365.getStatsVivo(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener stats.');
      }
    },
  };

  const handler = handlers[action];
  if (handler) {
    await handler();
  } else {
    await sendMessage(chatId, '⚠️ Acción no reconocida.');
  }
}

// ---- Composition root (Fase 7) ----
// Cablea las capas interface (lifecycle de Telegram + HTTP server) con los
// handlers de dominio que aún viven en este archivo (processMessage,
// handlePartidosCallback). Solo arranca el proceso cuando se ejecuta como entry
// point; bajo `require()` (tests) no se inicia polling, socket ni señales.
// Router de comandos migrados a Clean Architecture (Fase 7). `handleCommand` lo
// consulta primero; los comandos aún no migrados siguen en el if-else legacy.
const { router } = createContainer({ mundialista365, matchSearch, scores365, sendMessage });

const lifecycle = createLifecycle({
  telegramRequest,
  processMessage,
  handlePartidosCallback,
  logger,
  testConnection,
  setDbAvailable: (v) => { dbAvailable = v; },
});
const { server: httpServer } = createHttpServer({
  getDbAvailable: () => dbAvailable,
  handleWebhookUpdate: lifecycle.handleWebhookUpdate,
});

if (require.main === module && process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`🌐 Health server listening on port ${PORT}`);
  });
  lifecycle.init();

  const shutdown = (signal) => {
    logger.info(`Shutting down Telegram bot (${signal})...`);
    lifecycle.stop();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Superficie exportada para los golden-master tests (Fase 7).
module.exports = {
  handleCommand,
  processMessage,
  buildGameKeyboard,
  buildSingleGameKeyboard,
};
