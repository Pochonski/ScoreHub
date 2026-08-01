/**
 * src/infrastructure/config.js — Configuración del bot desde entorno (Fase 7, Fase 5).
 *
 * Único punto de acceso a las env vars del proceso del bot de Telegram. Antes
 * se leían ad-hoc en telegramBot.js y client.js; centralizarlas acá da una
 * fuente de verdad testeable y evita `process.env` disperso.
 *
 * (Las env vars compartidas con otras apps —Supabase, ADMIN_TOKEN, DATABASE_URL—
 *  se siguen leyendo en sus módulos compartidos: supabaseClient, adminAuth,
 *  database/connection.)
 */

require('dotenv').config();

module.exports = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  port: process.env.PORT || 8080,
  liveNotifierEnabled: process.env.ENABLE_LIVE_NOTIFIER === 'true',
};
