/**
 * src/interface/telegram/lifecycle.js — Ciclo de vida del bot (Fase 7, Fase 1).
 *
 * Extraído verbatim de telegramBot.js: ruteo de updates + long-polling + init.
 *   - handleWebhookUpdate → rutea un update (callback_query → handlePartidosCallback;
 *                           mensaje privado con texto → processMessage)
 *   - processUpdates      → batch
 *   - fetchOnce/pollingLoop→ long-polling con getUpdates
 *   - init                → deleteWebhook + arranca el loop + set dbAvailable
 *   - stop                → corta el loop (para SIGINT/SIGTERM)
 *
 * `createLifecycle(deps)` es una factory: recibe del composition root el
 * transporte (`telegramRequest`), los handlers de mensaje/callback
 * (`processMessage`, `handlePartidosCallback`), el logger, `testConnection` y un
 * `setDbAvailable` para publicar el estado de la DB.
 */

function createLifecycle({
  telegramRequest,
  processMessage,
  handlePartidosCallback,
  logger,
  testConnection,
  setDbAvailable,
}) {
  let polling = false;
  let pollOffset = 0;
  let shouldStop = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function handleWebhookUpdate(update) {
    // Callback queries (inline keyboard clicks)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const cbData = cb.data || '';
      const cbId = cb.id;
      await telegramRequest('answerCallbackQuery', { callback_query_id: cbId }).catch(() => {});
      const actionPrefix = cbData.split('_')[0];
      const knownActions = ['tip', 'trends', 'odds', 'h2h', 'previa', 'lineup', 'stats'];
      if (knownActions.includes(actionPrefix)) {
        await handlePartidosCallback(chatId, cbData);
      }
      return;
    }

    // Mensajes regulares
    const message = update?.message;
    if (!message || !message.text) return;
    if (message.chat.type !== 'private') return;

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text.trim();
    const user = message.from.username || message.from.first_name;

    await processMessage(chatId, userId, text, user);
  }

  /**
   * Procesa updates en batch (usado en init para updates pendientes)
   */
  async function processUpdates(updates) {
    if (!updates.ok || !updates.result) return;
    for (const update of updates.result) {
      await handleWebhookUpdate(update);
    }
  }

  /**
   * Un ciclo de getUpdates con long-polling (timeout 30s).
   */
  async function fetchOnce() {
    const params = { timeout: 30, allowed_updates: ['message', 'callback_query'] };
    if (pollOffset) params.offset = pollOffset;
    try {
      const updates = await telegramRequest('getUpdates', params, 35000);
      if (updates.ok && Array.isArray(updates.result) && updates.result.length > 0) {
        for (const update of updates.result) {
          try {
            await handleWebhookUpdate(update);
          } catch (e) {
            console.error('[polling] handler error:', e.message);
          }
        }
        // Confirmar procesado: offset = lastUpdateId + 1
        pollOffset = updates.result[updates.result.length - 1].update_id + 1;
      }
      return true;
    } catch (e) {
      if (e.isRateLimited) {
        const wait = (e.retryAfter || 1) * 1000;
        console.warn(`[polling] 429, esperando ${e.retryAfter}s...`);
        await sleep(wait);
      } else {
        console.error('[polling] getUpdates error:', e.message);
        await sleep(3000); // backoff fijo ante errores de red
      }
      return false;
    }
  }

  /**
   * Loop de long-polling continuo. Termina solo si shouldStop=true.
   */
  async function pollingLoop() {
    while (!shouldStop) {
      await fetchOnce();
    }
    console.log('[polling] loop detenido.');
  }

  /**
   * Inicializar bot
   */
  async function init() {
    logger.info('Starting ScoreHub Telegram bot...');

    testConnection().then(ok => {
      setDbAvailable(ok);
      if (!ok) {
        logger.warn('Demo mode active (no database)');
      }
    }).catch(() => {
      logger.warn('Demo mode active (no database)');
    });

    try {
      const wb = await telegramRequest('deleteWebhook', { drop_pending_updates: false });
      logger.info({ ok: wb.ok, description: wb.description }, 'deleteWebhook');
    } catch (e) {
      logger.error({ err: e.message }, 'deleteWebhook failed');
    }

    polling = true;
    pollingLoop().catch((e) => {
      logger.error({ err: e.message }, 'Polling loop crashed');
    });

    logger.info('ScoreHub Telegram ready (long-polling)');
  }

  function stop() {
    shouldStop = true;
  }

  return { handleWebhookUpdate, processUpdates, fetchOnce, pollingLoop, init, stop };
}

module.exports = { createLifecycle };
