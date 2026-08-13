/**
 * src/interface/telegram/commands/matchData.js — Comandos de datos de partidos
 * (Fase 7, Fase 3). /partidos, /manana, /tabla. Relocalizados VERBATIM.
 */

const log = require('../../../../utils/logger');

function registerMatchDataCommands(router, { matchHandler, cache, nlu, sendMessage, buildGameKeyboard }) {
  // /partidos, /hoy
  router.register(['/partidos', '/hoy'], async (ctx) => {
    const chatId = ctx.chatId;
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
      log.error({ err: e }, '[partidos] error');
      await sendMessage(chatId, '⚠️ Error al obtener los partidos.');
    }
  });

  // /manana, /mañana, /tomorrow
  router.register(['/manana', '/mañana', '/tomorrow'], async (ctx) => {
    const chatId = ctx.chatId;
    const hoyCR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
    const [y, m, d] = hoyCR.split('-').map(Number);
    const tomorrow = new Date(y, m - 1, d + 1).toISOString().split('T')[0].replace(/-/g, '');
    try {
      const matches = await cache.getWorldCupGames({ date: tomorrow });
      if (!matches || matches.length === 0) {
        await sendMessage(chatId,
          `📅 *MUNDIAL — MAÑANA*\n\n🟢 No hay partidos del Mundial programados para mañana.`);
        return;
      }
      const porGrupo = {};
      matches.forEach((m) => {
        const letra = (m.stageName || '').match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() || '?';
        if (!porGrupo[letra]) porGrupo[letra] = [];
        porGrupo[letra].push(m);
      });
      let msg = `📅 *MUNDIAL — MAÑANA*\n\n`;
      Object.keys(porGrupo).sort().forEach((g) => {
        msg += `📋 *GRUPO ${g}*\n`;
        porGrupo[g].forEach((m) => {
          const home = m.homeCompetitor?.name || m.homeTeam || '?';
          const away = m.awayCompetitor?.name || m.awayTeam || '?';
          msg += `⚽ ${home} vs ${away}`;
          const t = m.startTime || m.time || '';
          if (t) msg += `  _(${t.includes('T') ? t.split('T')[1]?.slice(0, 5) : t})_`;
          msg += '\n';
        });
        msg += '\n';
      });
      const keyboard = buildGameKeyboard(matches, ['tip', 'trends', 'odds']);
      await sendMessage(chatId, msg.trim(), { reply_markup: { inline_keyboard: keyboard } });
    } catch (e) {
      await sendMessage(chatId, '⚠️ No pude obtener partidos de mañana.');
    }
  });

  // /tabla, /clasificacion → delega 'tabla del mundial' al messageHandler
  router.register(['/tabla', '/clasificacion'], async (ctx) => {
    await nlu.delegate(ctx.chatId, 'tabla del mundial', async (text) => sendMessage(ctx.chatId, text));
  });
}

module.exports = { registerMatchDataCommands };
