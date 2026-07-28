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

  // Fase 7: TODOS los comandos slash están migrados a la arquitectura por capas
  // (interface/telegram/commands → application → infrastructure), registrados en
  // el router vía el composition root (container). Si ninguno matchea, se
  // devuelve false y processMessage delega el texto a la ruta de lenguaje natural.
  if (await router.dispatch({ cmd, text, chatId, userName, userId })) return true;
  return false;
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
const { router } = createContainer({
  mundialista365, mundialistaStats, matchSearch, scores365, matchHandler, cache,
  messageHandler, userStorage, pool,
  sendMessage, sendPhoto, sendMediaGroup,
  getTeamBadgeUrl, getCountryFlagUrl, getAthletePhotoUrl, getAthleteThumbUrl,
});

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
