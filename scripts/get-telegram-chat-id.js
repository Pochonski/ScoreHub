#!/usr/bin/env node
/**
 * scripts/get-telegram-chat-id.js — helper para obtener tu ALERT_CHAT_ID.
 *
 * 1. Abre Telegram y mándale cualquier mensaje al bot de ScoreHub.
 * 2. Corre: node scripts/get-telegram-chat-id.js
 * 3. Copia el `id` impreso a `.env` como ALERT_CHAT_ID=<id>.
 *
 * Lee getUpdates de la API de Telegram (mensajes de las últimas 24h).
 * Requiere TELEGRAM_BOT_TOKEN en env.
 */

require('dotenv').config();
const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!token || token.includes('tu_token')) {
  console.error('TELEGRAM_BOT_TOKEN no configurado en .env');
  process.exit(1);
}

https
  .get(`https://api.telegram.org/bot${token}/getUpdates?limit=20`, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.ok) {
          console.error('Telegram API error:', parsed.description);
          process.exit(1);
        }
        const seen = new Map();
        for (const u of parsed.result || []) {
          const chat = u.message?.chat || u.my_chat_member?.chat;
          if (chat) seen.set(chat.id, chat);
        }
        if (!seen.size) {
          console.log('Sin mensajes recientes. Mándale /start al bot e intenta de nuevo.');
          return;
        }
        for (const [id, chat] of seen) {
          const who = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || chat.type;
          console.log(`ALERT_CHAT_ID=${id}  (${who})`);
        }
      } catch (e) {
        console.error('Respuesta inválida:', e.message);
        process.exit(1);
      }
    });
  })
  .on('error', (e) => {
    console.error('Error de red:', e.message);
    process.exit(1);
  });
