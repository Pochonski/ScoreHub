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
const config = require('./src/infrastructure/config');

if (config.liveNotifierEnabled) {
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
const PORT = config.port;

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


// ---- Composition root (Fase 7) ----
// El container instancia toda la arquitectura por capas (router de comandos +
// dispatcher de callbacks). Acá se cablea con las capas de delivery (lifecycle
// de Telegram + HTTP server) y con `processMessage` (router de entrada, que aún
// vive en este archivo). Solo arranca el proceso cuando se ejecuta como entry
// point; bajo `require()` (tests) no se inicia polling, socket ni señales.
const { router, handleCallback } = createContainer({
  mundialista365, mundialistaStats, matchSearch, scores365, matchHandler, cache,
  messageHandler, userStorage, pool,
  sendMessage, sendPhoto, sendMediaGroup,
  getTeamBadgeUrl, getCountryFlagUrl, getAthletePhotoUrl, getAthleteThumbUrl,
});

const lifecycle = createLifecycle({
  telegramRequest,
  processMessage,
  handlePartidosCallback: handleCallback,
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
    // Auditoría 2026-Q3 Fase 5.1: flush contexto antes de salir.
    // Evita perder los últimos ~5s de conversación pendiente de persistir.
    try {
      conversationContext.flushSync();
    } catch (e) {
      logger.error({ err: e }, 'conversationContext.flushSync failed');
    }
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
};
