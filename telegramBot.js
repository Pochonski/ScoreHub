// ScoreHub - Telegram Bot (usando API directa)
require('dotenv').config();
const { install: installProcessGuard } = require('./utils/processGuard');
installProcessGuard({ name: 'telegramBot' });
// Servicios legacy que el container sigue esperando:
//   - matchSearch, scores365, cache: services sin port propio todavía
//   - userStorage, pool: lo usa registerProfileCommands (legacy)
//   - scores365-formatter (legacy/scores365-formatter.js): formatters de
//     365scores que se migrarán al adapter en una fase futura. Por ahora
//     scores365UseCases lo envuelve con Proxy enforcement.
// T2.1: messageHandler ya no se importa — todos los flows NL van por
// routeIntent (inyectado vía container más abajo).
const matchSearch = require('./services/matchSearch');
const scores365 = require('./services/scores365Service');
const cache = require('./services/mundialCache');
const mundialista365 = require('./src/legacy/scores365-formatter');
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
 * T2.1: handleNL — fallback NL unificado. Parsea con intentParser y
 * dispatcha vía routeIntent. Devuelve true si el mensaje fue atendido.
 *
 * El container se construye una sola vez al boot del proceso y se guarda
 * en `nlContext`. processMessage lo consume sin re-construirlo en cada
 * mensaje (caro: implica require de todo el árbol de use-cases).
 */
let nlContext = null;
async function ensureNLContext() {
  if (nlContext) return nlContext;
  const container = createContainer({
    matchSearch, scores365, mundialista365, cache, userStorage, pool,
    sendMessage, sendPhoto, sendMediaGroup,
    getTeamBadgeUrl, getCountryFlagUrl, getAthletePhotoUrl, getAthleteThumbUrl,
  });
  const { intentParser: ip, routeIntent: ri, context: ctx } = container.useCases;
  nlContext = { ip, ri, ctx };
  return nlContext;
}

async function handleNL({ userId, text }) {
  const { ip, ri, ctx } = await ensureNLContext();
  try {
    const chatContext = ctx.summarize(userId);
    const parsed = await ip.parseIntent(text, chatContext);
    if (!ip.isConfident(parsed)) return false;
    await ri({ userId, text, parsed });
    return true;
  } catch (e) {
    console.error('[telegramBot] handleNL error:', e.message);
    return false;
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

    // Fase 8: /follow, /unfollow, /misapuestas se atienden por el router
    // registrado en `container.js` (`registerFollowCommands`). El router
    // corre antes de handleCommand; si matchea, este if-else legacy se
    // salta por completo. Conservamos los handlers antiguos sólo como
    // fachada para callers que los importen directamente (tests, scripts).

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
      // Slash commands sin trigger registrado → fallback al parser NL.
      await handleNL({ userId: String(userId), text: textSinComando });
      return;
    }
  } else {
    // T1.1 + T2.1: texto libre va por routeIntent (parsea con intentParser,
    // dispatch por intent). Si el parser no es confiable, respondemos con
    // un mensaje genérico — antes caía al messageHandler legacy.
    const handled = await handleNL({ userId: String(userId), text });
    if (handled) return;
  }

  // Si llegamos acá, ningún handler entendió el mensaje.
  await sendMessage(chatId, '🤔 No entendí. Escribí *ayuda* para ver los comandos.');
}


// ---- Composition root (Fase 7) ----
// El container instancia toda la arquitectura por capas (router de comandos +
// dispatcher de callbacks). Acá se cablea con las capas de delivery (lifecycle
// de Telegram + HTTP server) y con `processMessage` (router de entrada, que aún
// vive en este archivo). Solo arranca el proceso cuando se ejecuta como entry
// point; bajo `require()` (tests) no se inicia polling, socket ni señales.
const { router, handleCallback } = createContainer({
  matchSearch, scores365, mundialista365, cache, userStorage, pool,
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
