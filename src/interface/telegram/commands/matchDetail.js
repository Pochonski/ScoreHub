/**
 * src/interface/telegram/commands/matchDetail.js — Comandos de detalle (Fase 7, Fase 3).
 *
 * /outrights + los comandos por gameId (/previa, /h2h, /odds, /stats-vivo,
 * /predicciones), cada uno con su usage prompt (exacto) y su variante con
 * argumento (prefijo). `registerMatchDetailCommands` los registra en el router;
 * el container le pasa los use-cases ya cableados + sendMessage.
 */

const { previaUsage, h2hUsage, oddsUsage, statsVivoUsage, prediccionesUsage } = require('../presenters/staticText');
const { moreOptions } = require('../presenters/matchDetail');

// Handler: envía un texto de uso estático.
const usageHandler = (sendMessage, usageFn) => async (ctx) => {
  await sendMessage(ctx.chatId, usageFn());
};

// Handler: texto del use-case + segundo mensaje "Más opciones" con teclado.
const detailWithOptions = (sendMessage, useCase, actions) => async (ctx) => {
  const text = await useCase(ctx.arg);
  await sendMessage(ctx.chatId, text);
  const opt = moreOptions(ctx.arg, actions);
  await sendMessage(ctx.chatId, opt.text, opt.options);
};

// Handler: solo el texto del use-case (sin teclado).
const detailPlain = (sendMessage, useCase) => async (ctx) => {
  await sendMessage(ctx.chatId, await useCase(ctx.arg));
};

function registerMatchDetailCommands(router, { matchDetail, sendMessage }) {
  // /outrights (sin args)
  router.register(['/outrights', '/cuotas'], async (ctx) => {
    await sendMessage(ctx.chatId, await matchDetail.outrights());
  });

  // /previa
  router.register(['/previa', '/preview'], usageHandler(sendMessage, previaUsage));
  router.registerPrefix(['/previa', '/preview'], detailWithOptions(sendMessage, matchDetail.previa, ['lineup', 'h2h', 'odds']));

  // /h2h
  router.register(['/h2h', '/historial-partido'], usageHandler(sendMessage, h2hUsage));
  router.registerPrefix(['/h2h', '/historial-partido'], detailWithOptions(sendMessage, matchDetail.h2h, ['previa', 'odds']));

  // /odds (el arg no lleva teclado)
  router.register(['/odds'], usageHandler(sendMessage, oddsUsage));
  router.registerPrefix(['/odds'], detailPlain(sendMessage, matchDetail.odds));

  // /stats-vivo
  router.register(['/stats-vivo', '/statsvivo', '/live-stats'], usageHandler(sendMessage, statsVivoUsage));
  router.registerPrefix(['/stats-vivo', '/statsvivo', '/live-stats'], detailWithOptions(sendMessage, matchDetail.statsVivo, ['odds']));

  // /predicciones
  router.register(['/predicciones', '/prediccion'], usageHandler(sendMessage, prediccionesUsage));
  router.registerPrefix(['/predicciones', '/prediccion'], detailWithOptions(sendMessage, matchDetail.predicciones, ['odds']));
}

module.exports = { registerMatchDetailCommands };
