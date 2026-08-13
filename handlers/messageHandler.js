// Router principal de mensajes
// Auditoría 2026-Q3 Fase 4.2/12.2: logger Pino (legacy messageHandler).
const log = require('../utils/logger');
const { pool, testConnection, withTransaction } = require('../database/connection');
const db = require('../database/db');
const { ESTADOS_USUARIO, INTENTOS } = require('../utils/constants');
const { parse } = require('./queryParser');
const matchHandler = require('./matchHandler');
const teamHandler = require('./teamHandler');
const statsHandler = require('./statsHandler');
const tableHandler = require('./tableHandler');
const bettingHandler = require('./bettingHandler');
const betImageHandler = require('./betImageHandler');
const geminiService = require('../services/geminiService');
const userStorage = require('../utils/userStorage');

// Estados en memoria (para registration flow y modo demo)
const MAX_MAP_SIZE = 1000; // Límite para prevenir memory leak
const userStates = new Map();
const demoUsers = new Map(); // Para modo demo sin DB

/**
 * Helper para enviar mensajes de forma segura (maneja errores de Puppeteer/WhatsApp)
 */
async function safeReply(message, text) {
  try {
    await message.reply(text);
  } catch (error) {
    // Ignorar errores de "Execution context was destroyed" o desconexión
    if (error.message?.includes('Execution context') ||
        error.message?.includes('Protocol error') ||
        error.message?.includes('target closed')) {
      log.warn('WhatsApp disconnected, response not sent');
    } else {
      log.error({ err: error }, 'Error sending message');
    }
  }
}

// Cleanup periódico de Maps para prevenir memory leak
function cleanupMaps() {
  // Limpiar userStates entries antiguas (más de 1 hora)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [key, value] of userStates.entries()) {
    if (value.lastAccess && value.lastAccess < oneHourAgo) {
      userStates.delete(key);
    }
  }

  // Si demoUsers crece demasiado, limpiar la mitad más antigua
  if (demoUsers.size > MAX_MAP_SIZE) {
    const entries = [...demoUsers.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    const toRemove = entries.slice(0, Math.floor(MAX_MAP_SIZE / 2));
    toRemove.forEach(([key]) => demoUsers.delete(key));
  }
}

// Cleanup cada 10 minutos. `.unref()` para no mantener el event loop vivo al apagar.
const cleanupTimer = setInterval(cleanupMaps, 10 * 60 * 1000);
cleanupTimer.unref();

let dbAvailable = false;
let dbCheckPromise = null;

// Test DB connection on startup - asegurar que la verificación complete antes de procesar
async function initDbConnection() {
  dbAvailable = await testConnection();
  if (!dbAvailable) {
    log.warn('Modo demo activo (sin base de datos)');
  }
  return dbAvailable;
}

// Iniciar verificación de DB
dbCheckPromise = initDbConnection();

/**
 * Espera a que la verificación de DB complete
 */
async function waitForDb() {
  if (dbAvailable) return true;
  if (dbCheckPromise) {
    await dbCheckPromise;
  }
  return dbAvailable;
}

/**
 * Obtiene datos de usuario desde DB (o demo si no hay DB)
 */
async function getUserData(userId) {
  // Esperar a que DB esté lista si aún se está verificando
  await waitForDb();
  if (!dbAvailable) {
    // Modo demo: crear usuario temporal ya registrado automáticamente
    if (!demoUsers.has(userId)) {
      demoUsers.set(userId, {
        id: userId,
        alias: 'Usuario',
        estado: ESTADOS_USUARIO.REGISTRADO, // Ya registrado en modo demo
        lastAccess: Date.now()
      });
    }
    const userData = demoUsers.get(userId);
    userData.lastAccess = Date.now();
    return userData;
  }

  try {
    const { data, error: err } = await db.query('usuarios', {
      select: '*',
      eq: { id: userId },
      maybeSingle: true,
    });
    if (err) throw err;
    return data || null;
  } catch (error) {
    log.error({ err: error }, 'Error getting user');
    // Fallback a modo demo
    if (!demoUsers.has(userId)) {
      demoUsers.set(userId, {
        id: userId,
        alias: 'Usuario',
        estado: ESTADOS_USUARIO.REGISTRADO,
        lastAccess: Date.now()
      });
    }
    const userData = demoUsers.get(userId);
    userData.lastAccess = Date.now();
    return userData;
  }
}

/**
 * Alias ya existe?
 */
async function aliasYaExiste(alias) {
  if (!dbAvailable) {
    // En modo demo, verificar en memoria
    for (const user of demoUsers.values()) {
      if (user.alias.toLowerCase() === alias.toLowerCase()) return true;
    }
    return false;
  }

  try {
    const { data, error: err } = await db.query('usuarios', {
      select: 'id',
      eq: { alias },
      limit: 1,
    });
    if (err) throw err;
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Registra nuevo usuario
 */
async function registrarUsuario(userId, alias) {
  // Siempre guardar en memoria para demo
  demoUsers.set(userId, {
    id: userId,
    alias: alias,
    estado: ESTADOS_USUARIO.REGISTRADO,
    lastAccess: Date.now()
  });

  if (!dbAvailable) return true;

  try {
    const { error: err } = await db.upsert('usuarios', [{
      id: userId,
      alias,
      fecha_registro: new Date().toISOString(),
      estado: ESTADOS_USUARIO.REGISTRADO,
    }], 'id');
    if (err) throw err;
    return true;
  } catch (error) {
    log.error({ err: error }, 'Error registering user');
    return true; // Seguir en modo demo
  }
}

/**
 * Handler principal de mensajes
 */
async function messageHandler(client, message) {
  // Ignorar status y grupos
  if (message.from === 'status@broadcast') return;
  if (message.from.endsWith('@g.us')) return;

  const userId = message.from;
  const text = message.body.trim();

  log.info({ length: text.length }, 'Mensaje recibido');

  // Obtener usuario
  let user = await getUserData(userId);

  // === REGISTRATION FLOW ===
  if (!user || user.estado !== ESTADOS_USUARIO.REGISTRADO) {
    const state = userStates.get(userId);

    if (state?.value === ESTADOS_USUARIO.ESPERANDO_ALIAS) {
      const alias = text;
      if (await aliasYaExiste(alias)) {
        await safeReply(message, '❌ Ese alias ya está en uso. Prueba con otro:');
      } else {
        await registrarUsuario(userId, alias);
        userStates.delete(userId);
        await safeReply(message, `✅ ¡Perfecto ${alias}! Soy *ScoreHub*, tu asistente de fútbol y apuestas.\n\nEscribe *ayuda* para ver qué puedo hacer.`);
      }
      return;
    }

    // Primer mensaje - pedir alias
    userStates.set(userId, { value: ESTADOS_USUARIO.ESPERANDO_ALIAS, lastAccess: Date.now() });
    await safeReply(message, '¡Hola! 👋 Soy *ScoreHub*, tu asistente de fútbol.\n\n¿Cómo quieres que te llame? Escribe tu alias:');
    return;
  }

  // === IMAGE PROCESSING (BET TRACKING) ===
  if (message.hasMedia) {
    try {
      const media = await message.downloadMedia();
      if (media.mimetype.startsWith('image/')) {
        await betImageHandler.procesarImagenApuesta(client, message, media);
        return;
      }
    } catch (error) {
      log.error({ err: error }, 'Error processing image');
      await safeReply(message, '⚠️ No pude procesar la imagen. Intenta de nuevo.');
      return;
    }
  }

  // === USER REGISTERED - PROCESS MESSAGE ===
  // Primero intentar con Gemini para mejor comprensión de lenguaje natural
  let parsedFromGemini = null;
  let parsed = { intent: 'UNKNOWN' };

  // Manejar confirmación de /reset ANTES de procesar con Gemini
  const lowerText = (text || '').toLowerCase().trim();
  if (lowerText === 'borrar todo' || lowerText === 'borrartodo' || lowerText === '/borrar todo' || lowerText === '/borrartodo') {
    if (userStorage.consumePendingReset(userId)) {
      try {
        const r = await userStorage.clearUserData(userId);
        await message.reply(
          `🗑 *Datos borrados*\n\n` +
          `• Apodo local: ${r.alias ? 'sí' : 'no'}\n` +
          `• Equipos seguidos: ${r.equipos_seguidos}\n` +
          `• Historial de consultas: ${r.historial_consultas}\n\n` +
          `Todo limpio. ¡Avisame si querés registrar algo de nuevo!`
        );
      } catch (e) {
        log.error({ err: e }, 'Error borrando datos');
        await message.reply('⚠️ Hubo un error al borrar datos. Contactá al admin.');
      }
      return;
    } else {
      await message.reply('❌ No tenés un reset pendiente. Usá /reset para iniciar uno.');
      return;
    }
  } else if (userStorage && userStorage.consumePendingReset) {
    // Si hay reset pendiente y el user mandó algo más, cancelarlo en silencio
    userStorage.cancelPendingReset && userStorage.cancelPendingReset(userId);
  }

  try {
    const geminiResult = await geminiService.analyzeMessage(text);
    if (geminiResult.success && geminiResult.intent !== 'UNKNOWN') {
      const detail = geminiResult.equipo
        || (geminiResult.home && geminiResult.away ? `${geminiResult.home} vs ${geminiResult.away}` : null)
        || geminiResult.liga
        || geminiResult.grupo
        || '';
      log.info({ intent: geminiResult.intent, detail }, 'Gemini parsed');
      parsedFromGemini = {
        intent: geminiResult.intent,
        equipo: geminiResult.equipo,
        home: geminiResult.home,
        away: geminiResult.away,
        fecha: geminiResult.fecha,
        liga: geminiResult.liga,
        grupo: geminiResult.grupo
      };
    }
  } catch (geminiError) {
    log.warn({ err: geminiError }, 'Gemini error, usando parser local');
  }

  // Si Gemini no entendió, usar parser local
  if (!parsedFromGemini) {
    parsed = await parse(text);
    log.info({ intent: parsed.intent }, 'Parser local');
  }

  let response = '';

  try {
    const currentParsed = parsedFromGemini || parsed;

    // Interceptar UNKNOWN para mensajes especiales (ej: apuestas, fuera de alcance)
    if (currentParsed.intent === INTENTOS.DESCONOCIDO || !currentParsed.intent) {
      const lowerText = (text || '').toLowerCase().trim();
      if (/apostar|apuesta|bet|apuesta de|cuota/.test(lowerText)) {
        response = `🎰 *Apuestas*\n\n` +
          `Este bot no tiene integración con casas de apuestas todavía.\n\n` +
          `Lo que SÍ puedo hacer ahora:\n` +
          `📊 *Analizar partidos* — Pídeme "/analizar Brasil vs Francia" y te doy estadísticas, forma y pronóstico.\n` +
          `📈 *Estadísticas* — "Estadísticas de Brasil" o "Cuántos córners hizo Argentina"\n` +
          `📋 *Enfrentamientos* — "Argentina vs Francia" para ver el historial\n\n` +
          `💡 _Si querés registrar tu apuesta en otro sistema (bet tracker), avisame y lo implemento._`;
      } else if (lowerText.length === 0 || lowerText === 'hola' || lowerText === 'hi') {
        // Dejar al saludo manejarlo
      } else {
        response = `🤔 No entendí "${text}".\n\nEscribe *ayuda* para ver los comandos disponibles.`;
      }
    }

    if (!response) {
    switch (currentParsed.intent) {
      case INTENTOS.SALUDO:
        response = `¡Hola ${user.alias}! 👋🏆 Bienvenido al asistente del *ScoreHub*\n\n` +
          `📋 *Comandos:*\n` +
          `  "¿Cómo quedó [equipo]?"\n` +
          `  "[equipo] vs [equipo]"\n` +
          `  "Analiza [equipo] vs [equipo]"\n` +
          `  "Dame info de [equipo]"\n` +
          `  "Tabla del Mundial"\n` +
          `  "Seguir [equipo]"\n\n` +
          `Ejemplo: "Cómo quedó Brasil?"`;
        break;

      case INTENTOS.HELP:
        response = `📖 *COMANDOS - ScoreHub*\n\n` +
          `⚽ *Resultados:*\n` +
          `  "¿Cómo quedó Brasil?"\n` +
          `  "México vs Argentina"\n\n` +
          `📊 *Análisis:*\n` +
          `  "Analiza Brasil vs Francia"\n` +
          `  "Estadísticas de España"\n\n` +
          `👥 *Equipos:*\n` +
          `  "Dame info de Alemania"\n` +
          `  "Seguir Brasil"\n` +
          `  "Mis equipos"\n\n` +
          `🏆 *Tablas:*\n` +
          `  "Tabla del Mundial"\n` +
          `  "Tabla de la Premier"`;
        break;

      case INTENTOS.PARTIDOS_HOY:
        response = await matchHandler.getPartidosHoy(currentParsed);
        break;

      case INTENTOS.PARTIDOS_FECHA:
        response = await matchHandler.getPartidosFecha(currentParsed.fecha);
        break;

      case INTENTOS.RESULTADO:
        response = await matchHandler.getResultadoEquipo(currentParsed.equipo);
        break;

      case INTENTOS.RESULTADO_VS:
        response = await matchHandler.getResultadoVS(currentParsed.home, currentParsed.away);
        break;

      case INTENTOS.INFO_EQUIPO:
        response = await teamHandler.getInfoEquipo(currentParsed.equipo);
        break;

      case INTENTOS.ESTADISTICA:
        response = await statsHandler.getEstadisticas(currentParsed);
        break;

      case INTENTOS.TABLA:
        response = await tableHandler.getTabla(currentParsed.liga);
        break;

      case INTENTOS.TABLA_MUNDIAL:
        response = await tableHandler.getTablaMundial();
        break;

      case INTENTOS.TABLA_GRUPO:
        response = await tableHandler.getTablaGrupoMundial(currentParsed.grupo);
        break;

      case INTENTOS.ANALISIS:
        if (currentParsed.home && currentParsed.away) {
          response = await bettingHandler.analizarEnfrentamiento(currentParsed.home, currentParsed.away);
        } else if (currentParsed.equipo) {
          response = await bettingHandler.analizarEquipo(currentParsed.equipo);
        } else {
          response = '⚠️ Indica dos equipos para analizar. Ej: "Analiza Brasil vs Argentina"';
        }
        break;

      case INTENTOS.SEGUIR_EQUIPO:
        response = await teamHandler.seguirEquipo(userId, currentParsed.equipo);
        break;

      case INTENTOS.DEJAR_SEGUIR:
        response = await teamHandler.dejarSeguirEquipo(userId, currentParsed.equipo);
        break;

      case INTENTOS.MIS_EQUIPOS:
        response = await teamHandler.getEquiposSeguidos(userId);
        break;

      default:
        response = `🤔 No entendí "${text}".\n\nEscribe *ayuda* para ver los comandos disponibles.`;
    }
    }
  } catch (error) {
    log.error({ err: error }, 'Error handling message');
    response = '⚠️ Ocurrió un error procesando tu consulta. Intenta de nuevo.';
  }

  // Guardar en historial (ignorar si DB no disponible)
  if (dbAvailable) {
    try {
      await db.execAdvanced(
        'INSERT INTO historial_consultas (id_usuario, consulta, tipo, respuesta, fecha) VALUES ($1, $2, $3, $4, NOW())',
        [userId, text, parsed.intent, response]
      );
    } catch (error) {
      log.error({ err: error }, 'Error saving query');
    }
  }

  // Send response (con manejo de errores de Puppeteer)
  try {
    await message.reply(response);
  } catch (replyError) {
    log.error({ err: replyError }, 'Error sending reply (posible desconexión WhatsApp)');
  }
}

module.exports = messageHandler;