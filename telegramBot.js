// BotMundialista - Telegram Bot (usando API directa)
require('dotenv').config();
const fetch = require('node-fetch');
const messageHandler = require('./handlers/messageHandler');
const { pool, testConnection } = require('./database/connection');

// Token del bot de Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Offset para polling
let offset = 0;
let isRunning = false;

// Flag para saber si la DB está disponible
let dbAvailable = false;

/**
 * Hace una solicitud a la API de Telegram
 */
async function telegramRequest(method, params = {}) {
  const url = `${API_URL}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return response.json();
}

/**
 * Envía un mensaje
 */
async function sendMessage(chatId, text, options = {}) {
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...options
  });
}

/**
 * Procesa las actualizaciones (mensajes)
 */
async function processUpdates(updates) {
  if (!updates.ok || !updates.result) return;

  for (const update of updates.result) {
    // Actualizar offset
    if (update.update_id >= offset) {
      offset = update.update_id + 1;
    }

    // Solo procesar mensajes de texto en chats privados
    const message = update.message;
    if (!message || !message.text) continue;
    if (message.chat.type !== 'private') continue;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const user = message.from.username || message.from.first_name;

    console.log(`📩 Telegram: [${user}] ${text}`);

    try {
      // Crear objeto message simulado para reutilizar messageHandler
      const messageObj = {
        from: chatId.toString(),
        body: text,
        hasMedia: false,
        reply: async (responseText) => {
          await sendMessage(chatId, responseText);
        }
      };

      // Llamar al messageHandler
      await messageHandler(null, messageObj);
    } catch (error) {
      console.error('Error procesando mensaje Telegram:', error);
      await sendMessage(chatId, '⚠️ Ocurrió un error. Intenta de nuevo.');
    }
  }
}

/**
 * Ciclo principal de polling
 */
async function pollingCycle() {
  if (!isRunning) return;

  try {
    const updates = await telegramRequest('getUpdates', {
      offset,
      timeout: 30
    });
    await processUpdates(updates);
  } catch (error) {
    console.error('Error en polling:', error.message);
  }

  // Continuar el loop
  if (isRunning) {
    setTimeout(pollingCycle, 500);
  }
}

/**
 * Inicializar bot
 */
async function init() {
  console.log('🚀 BotMundialista Telegram iniciando...');

  // No esperar DB connection (no bloqueante)
  testConnection().then(ok => {
    dbAvailable = ok;
    if (!dbAvailable) {
      console.log('⚠️ Modo demo activo (sin base de datos)');
    }
  }).catch(() => {
    console.log('⚠️ Modo demo activo (sin base de datos)');
  });

  // Obtener updates pendientes antes de iniciar polling
  try {
    const updates = await telegramRequest('getUpdates', { offset: 0, timeout: 0 });
    if (updates.ok && updates.result.length > 0) {
      offset = updates.result[updates.result.length - 1].update_id + 1;
      console.log(`📬 Limpiando ${updates.result.length} updates pendientes`);
    }
  } catch (error) {
    console.error('Error limpiando updates:', error.message);
  }

  // Iniciar polling
  isRunning = true;
  console.log('✅ BotMundialista Telegram listo!');
  console.log(`📱 Token: ${TELEGRAM_TOKEN?.substring(0, 10)}...`);
  console.log('');
  console.log('Comandos disponibles:');
  console.log('  - "¿Cómo quedó Brasil?"');
  console.log('  - "Brasil vs Argentina"');
  console.log('  - "Dame info de Alemania"');
  console.log('  - "Tabla del Mundial"');
  console.log('  - "Tabla Grupo A"');
  console.log('  - "Cuántos córners hizo Brasil?"');

  pollingCycle();
}

// Iniciar
init();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Apagando bot de Telegram...');
  isRunning = false;
  process.exit(0);
});
