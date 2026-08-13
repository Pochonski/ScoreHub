/**
 * src/interface/telegram/callbacks.js — Dispatcher de callbacks de botones inline
 * (Fase 7, broche de Fase 3).
 *
 * Los teclados inline de partidos generan `callback_query` con data
 * `<action>_<gameId>`. Este dispatcher rutea cada acción (tip/trends/odds/h2h/
 * previa/lineup/stats) a su respuesta. Relocalizado VERBATIM desde
 * `handlePartidosCallback` en telegramBot.js, reusando el ScoresGateway y el
 * presenter `moreOptions`.
 */

const log = require('../../../utils/logger');
const { moreOptions } = require('./presenters/matchDetail');

function createCallbackDispatcher({ scoresGateway, cache, sendMessage }) {
  const sendMore = async (chatId, gameId, actions) => {
    const opt = moreOptions(gameId, actions);
    await sendMessage(chatId, opt.text, opt.options);
  };

  const handlers = {
    tip: async (chatId, gameId) => {
      try {
        const game = await cache.getGameById(gameId);
        if (game?.homeCompetitor?.name && game?.awayCompetitor?.name) {
          const tip = await scoresGateway.formatTipForGame(game);
          if (tip) {
            await sendMessage(chatId, tip);
            if (gameId) await sendMore(chatId, gameId, ['trends', 'odds']);
          } else {
            await sendMessage(chatId, '⚠️ No hay tip disponible para ese partido.');
          }
        } else {
          await sendMessage(chatId, '⚠️ No pude obtener información de ese partido.');
        }
      } catch (e) {
        log.error({ err: e }, '[callback tip] error');
        await sendMessage(chatId, '⚠️ Error al obtener tip de ese partido.');
      }
    },
    trends: async (chatId, gameId) => {
      try {
        const t = await scoresGateway.getTendenciasForGame(gameId);
        await sendMessage(chatId, t);
        await sendMore(chatId, gameId, ['tip', 'odds']);
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener tendencias.');
      }
    },
    odds: async (chatId, gameId) => {
      try {
        const t = await scoresGateway.getOdds(gameId);
        await sendMessage(chatId, t);
        await sendMore(chatId, gameId, ['tip', 'trends']);
      } catch (e) {
        log.error({ err: e }, '[callback odds] error');
        await sendMessage(chatId, '⚠️ Error al obtener cuotas.');
      }
    },
    h2h: async (chatId, gameId) => {
      try {
        const t = await scoresGateway.getH2H(gameId);
        await sendMessage(chatId, t);
        await sendMore(chatId, gameId, ['previa', 'odds']);
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener historial.');
      }
    },
    previa: async (chatId, gameId) => {
      try {
        const t = await scoresGateway.getPrevia(gameId);
        await sendMessage(chatId, t);
        await sendMore(chatId, gameId, ['lineup', 'h2h', 'odds']);
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener previa.');
      }
    },
    lineup: async (chatId, gameId) => {
      try {
        const t = await scoresGateway.getAlineacion(gameId);
        await sendMessage(chatId, t);
        await sendMore(chatId, gameId, ['previa', 'odds']);
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener alineación.');
      }
    },
    stats: async (chatId, gameId) => {
      try {
        const t = await scoresGateway.getStatsVivo(gameId);
        await sendMessage(chatId, t);
        await sendMore(chatId, gameId, ['odds']);
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener stats.');
      }
    },
  };

  return async function handleCallback(chatId, callbackData) {
    const idx = callbackData.indexOf('_');
    if (idx === -1) {
      await sendMessage(chatId, '⚠️ Acción no válida.');
      return;
    }
    const action = callbackData.substring(0, idx);
    const gameId = callbackData.substring(idx + 1);
    const handler = handlers[action];
    if (handler) {
      await handler(chatId, gameId);
    } else {
      await sendMessage(chatId, '⚠️ Acción no reconocida.');
    }
  };
}

module.exports = { createCallbackDispatcher };
