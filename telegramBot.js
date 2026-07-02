// BotMundialista - Telegram Bot (usando API directa)
require('dotenv').config();
const http = require('http');
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

// Mini servidor HTTP para health checks de Azure App Service
// Azure Linux requiere que el proceso escuche en PORT para considerarlo saludable
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: 'BotMundialista',
      uptime: process.uptime(),
      db: dbAvailable ? 'connected' : 'demo',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});

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
 * Maneja comandos de Telegram (que empiezan con /)
 */
async function handleCommand(chatId, command, userName) {
  const cmd = command.toLowerCase();
  const alias = userName || 'Usuario';

  switch (cmd) {
    case '/start':
    case '/inicio':
      await sendMessage(chatId,
        `🏆 *BotMundialista* - Asistente del Mundial 2026\n\n` +
        `¡Hola ${alias}! 👋 Soy tu asistente de fútbol.\n\n` +
        `📱 *Comandos disponibles:*\n` +
        `  /start - Iniciar\n` +
        `  /help - Ver comandos\n` +
        `  /partidos - Partidos de hoy\n` +
        `  /tabla - Tabla del Mundial\n` +
        `  /resultado [equipo] - Resultado de un equipo\n` +
        `  /analizar [eq1] vs [eq2] - Análisis de partido\n\n` +
        `O escribe normalmente: "¿Cómo quedó Brasil?"`
      );
      return true;

    case '/help':
    case '/ayuda':
      await sendMessage(chatId,
        `📖 *COMANDOS - MUNDIAL 2026*\n\n` +
        `⚽ *Resultados:*\n` +
        `  /resultado Brasil\n` +
        `  "Brasil vs Argentina"\n\n` +
        `📊 *Análisis:*\n` +
        `  /analizar Brasil vs Francia\n` +
        `  /stats España\n\n` +
        `👥 *Equipos:*\n` +
        `  /info Alemania\n` +
        `  /seguir Brasil\n` +
        `  /miequipos\n\n` +
        `🏆 *Tablas:*\n` +
        `  /tabla - Tabla general\n` +
        `  /grupo A - Tabla grupo A`
      );
      return true;

    case '/partidos':
    case '/hoy':
      // Crear objeto para messageHandler
      const msgPartidos = {
        from: chatId.toString(),
        body: 'partidos de hoy',
        hasMedia: false,
        reply: async (text) => await sendMessage(chatId, text)
      };
      await messageHandler(null, msgPartidos);
      return true;

    case '/tabla':
    case '/clasificacion':
      const msgTabla = {
        from: chatId.toString(),
        body: 'tabla del mundial',
        hasMedia: false,
        reply: async (text) => await sendMessage(chatId, text)
      };
      await messageHandler(null, msgTabla);
      return true;

    default:
      // Comandos con argumentos: /resultado, /analizar, /info, /seguir
      if (cmd.startsWith('/resultado ')) {
        const equipo = text.replace('/resultado ', '').replace('/Resultado ', '');
        const msgRes = {
          from: chatId.toString(),
          body: `como quedo ${equipo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgRes);
        return true;
      }

      if (cmd.startsWith('/analizar ')) {
        const vsText = text.replace('/analizar ', '').replace('/Analizar ', '');
        const msgAna = {
          from: chatId.toString(),
          body: `analiza ${vsText}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgAna);
        return true;
      }

      if (cmd.startsWith('/info ')) {
        const equipo = text.replace('/info ', '').replace('/Info ', '');
        const msgInfo = {
          from: chatId.toString(),
          body: `dame info de ${equipo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgInfo);
        return true;
      }

      if (cmd.startsWith('/seguir ')) {
        const equipo = text.replace('/seguir ', '').replace('/Seguir ', '');
        const msgSeg = {
          from: chatId.toString(),
          body: `seguir ${equipo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgSeg);
        return true;
      }

      if (cmd.startsWith('/grupo ')) {
        const grupo = text.replace('/grupo ', '').replace('/Grupo ', '').toUpperCase();
        const msgGrupo = {
          from: chatId.toString(),
          body: `tabla grupo ${grupo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgGrupo);
        return true;
      }

      return false;
  }
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

    // Si es un comando, intentar manejarlo
    if (text.startsWith('/')) {
      const handled = await handleCommand(chatId, text, user);
      if (handled) continue;
      // Si no se reconoció el comando, pasar al messageHandler como texto normal (sin el /)
      const textSinComando = text.replace(/^\/[a-z]+\s*/i, '');
      if (textSinComando !== text) {
        const msgObj = {
          from: chatId.toString(),
          body: textSinComando,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgObj);
        continue;
      }
    }

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
