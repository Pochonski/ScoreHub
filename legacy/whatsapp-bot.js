/**
 * legacy/whatsapp-bot.js — Bot de WhatsApp (LEGACY, INACTIVO).
 *
 * Cuarentenado en la Fase 7 (Clean Architecture). El producto activo es el bot
 * de Telegram (telegramBot.js). Este código se conserva para referencia pero:
 *   - Las dependencias `whatsapp-web.js` y `qrcode-terminal` fueron removidas de
 *     package.json (eran pesadas — Puppeteer/Chromium — y solo las usaba este
 *     archivo). Para reactivarlo hay que reinstalarlas.
 *   - `messageHandler` es platform-agnostic y sigue vivo (lo usa Telegram).
 */
require('dotenv').config();

if (!process.env.ENABLE_WHATSAPP || process.env.ENABLE_WHATSAPP !== 'true') {
  console.log('WhatsApp bot disabled (set ENABLE_WHATSAPP=true to enable)');
  module.exports = {};
  return;
}

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const messageHandler = require('../handlers/messageHandler');
const followHandler = require('../handlers/followHandler');
const conversationalHandler = require('../handlers/conversationalHandler');
const notificationService = require('../services/notificationService');
const telegramNotifier = require('../services/telegramNotifier');
const { testConnection } = require('../database/connection');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: process.env.WA_SESSION_DIR || '.wwebjs_auth'
  }),
  puppeteer: {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// QR Code event
client.on('qr', (qr) => {
  console.log('\n📱 Escanea el QR con tu WhatsApp:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n');
});

// Authenticated
client.on('authenticated', () => {
  console.log('✅ WhatsApp autenticado correctamente');
});

// Auth failure
client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
});

// Ready
client.on('ready', async () => {
  console.log('🤖 ScoreHub está listo!');

  // Configurar notification service con el cliente de WhatsApp
  notificationService.setClient(client);

  // Test database connection
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('⚠️ Advertencia: La base de datos no está disponible');
  }
});

// Disconnected
client.on('disconnected', (reason) => {
  console.log('⚠️ WhatsApp desconectado:', reason);
});

// Message handler
client.on('message', async (message) => {
  try {
    const text = (message.body || '').trim();
    const chatId = (message.from || '').replace(/[^0-9]/g, '') || message.from;
    if (text.startsWith('/')) {
      const lower = text.toLowerCase().split(' ')[0].split('@')[0];
      if (lower === '/follow') {
        const args = text.replace(/^\/[a-z@0-9_]+/i, '').trim();
        const r = await followHandler.handleFollowCommand(chatId, args);
        await message.reply(r.message);
        return;
      }
      if (lower === '/unfollow' || lower === '/dejarseguir') {
        const args = text.replace(/^\/[a-z@0-9_]+/i, '').trim();
        const r = await followHandler.handleUnfollowCommand(chatId, args);
        await message.reply(r.message);
        return;
      }
      if (lower === '/misapuestas' || lower === '/siguiendo') {
        const r = await followHandler.handleListCommand(chatId);
        await message.reply(r.message);
        return;
      }
    } else {
      try {
        const result = await conversationalHandler.handleMessage(chatId, text);
        if (result.handled && result.message) {
          await message.reply(result.message);
          return;
        }
      } catch (e) {
        console.error('[bot.js] conversationalHandler error:', e.message);
      }
    }
    await messageHandler(client, message);
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    await message.reply('⚠️ Ocurrió un error. Intenta de nuevo.');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Apagando bot...');
  await client.destroy();
  process.exit(0);
});

// Start
console.log('🚀 Iniciando ScoreHub...');
client.initialize();