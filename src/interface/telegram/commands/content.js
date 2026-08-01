/**
 * src/interface/telegram/commands/content.js — Comandos de contenido (Fase 7, Fase 3).
 *
 * /noticias, /equipoideal, /bracket (+grupos/todo), /historial, /goleadores.
 * `registerContentCommands` los registra en el router; el container le pasa los
 * use-cases + sendMessage/sendPhoto.
 */

function registerContentCommands(router, { content, sendMessage, sendPhoto }) {
  // /noticias (top) + /noticias <equipo>
  router.register(['/noticias'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.noticias(null));
  });
  router.registerPrefix(['/noticias'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.noticias(ctx.arg));
  });

  // /equipoideal
  router.register(['/equipoideal', '/idealtm', '/tow'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.equipoIdeal());
  });

  // /bracket (eliminatorias / grupos / todo)
  router.register(['/bracket', '/llaves'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.bracket('eliminatorias'));
  });
  router.register(['/bracket grupos', '/llaves grupos'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.bracket('grupos'));
  });
  router.register(['/bracket todo', '/bracket completo'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.bracket('todo'));
  });

  // /historial (todos) + /historial <año|equipo>
  router.register(['/historial'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.historial(null));
  });
  router.registerPrefix(['/historial'], async (ctx) => {
    await sendMessage(ctx.chatId, await content.historial(ctx.arg));
  });

  // /goleadores (foto si hay + outrights best-effort)
  router.register(['/goleadores', '/rankinggoleador', '/topgoleador'], async (ctx) => {
    const { scorers, outrights } = await content.goleadores();
    if (scorers.photoUrl) {
      await sendPhoto(ctx.chatId, scorers.photoUrl, scorers.text);
    } else {
      await sendMessage(ctx.chatId, scorers.text);
    }
    if (outrights) await sendMessage(ctx.chatId, outrights);
  });
}

module.exports = { registerContentCommands };
