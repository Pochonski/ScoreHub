/**
 * src/interface/telegram/commands/trends.js — Comandos /tip y /tendencias (Fase 7, Fase 3).
 *
 * Parsean "eq1 vs eq2" (VS_RE, idéntico al legacy) y, si resuelven el partido,
 * agregan el bloque "💡 Más opciones". El separador `━━━` de /tendencias top
 * también es idéntico.
 */

const { moreOptions } = require('../presenters/matchDetail');
const { tipUsage, tipFormatError, tendenciasUsage } = require('../presenters/staticText');

const VS_RE = /^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i;

function registerTrendsCommands(router, { trends, sendMessage }) {
  // /tip (usage) + /tip <eq1 vs eq2>
  router.register(['/tip'], async (ctx) => {
    await sendMessage(ctx.chatId, tipUsage());
  });
  router.registerPrefix(['/tip'], async (ctx) => {
    const m = ctx.arg.match(VS_RE);
    if (!m) {
      await sendMessage(ctx.chatId, tipFormatError());
      return;
    }
    const home = m[1].trim();
    const away = m[2].trim();
    await sendMessage(ctx.chatId, await trends.tip(home, away));
    const game = await trends.findGame(home, away);
    if (game?.id) {
      const opt = moreOptions(game.id, ['trends', 'odds']);
      await sendMessage(ctx.chatId, opt.text, opt.options);
    }
  });

  // /tendencias (top: trends + outrights) + /tendencias <eq1 vs eq2>
  router.register(['/tendencias', '/trends'], async (ctx) => {
    const t = await trends.topTrends();
    const o = await trends.outrights();
    await sendMessage(ctx.chatId, t + '\n\n━━━━━━━━━━━━━━━━\n' + o);
  });
  router.registerPrefix(['/tendencias', '/trends'], async (ctx) => {
    const m = ctx.arg.match(VS_RE);
    if (m) {
      const home = m[1].trim();
      const away = m[2].trim();
      await sendMessage(ctx.chatId, await trends.trendsByTeams(home, away));
      const game = await trends.findGame(home, away);
      if (game?.id) {
        const opt = moreOptions(game.id, ['tip', 'odds']);
        await sendMessage(ctx.chatId, opt.text, opt.options);
      }
      return;
    }
    await sendMessage(ctx.chatId, tendenciasUsage());
  });
}

module.exports = { registerTrendsCommands };
