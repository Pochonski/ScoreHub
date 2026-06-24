// Router principal de mensajes
require('dotenv').config();
const { pool, testConnection } = require('../database/connection');
const { ESTADOS_USUARIO, INTENTOS } = require('../utils/constants');
const { parse } = require('./queryParser');
const matchHandler = require('./matchHandler');
const teamHandler = require('./teamHandler');
const statsHandler = require('./statsHandler');
const tableHandler = require('./tableHandler');
const bettingHandler = require('./bettingHandler');
const betImageHandler = require('./betImageHandler');

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
      console.error('⚠️ WhatsApp desconectado, no se pudo enviar respuesta');
    } else {
      console.error('Error enviando mensaje:', error.message);
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

// Cleanup cada 10 minutos
setInterval(cleanupMaps, 10 * 60 * 1000);

let dbAvailable = false;
let dbCheckPromise = null;

// Test DB connection on startup - asegurar que la verificación complete antes de procesar
async function initDbConnection() {
  dbAvailable = await testConnection();
  if (!dbAvailable) {
    console.log('⚠️ Modo demo activo (sin base de datos)');
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
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user:', error.message);
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
    const result = await pool.query('SELECT id FROM usuarios WHERE alias = $1', [alias]);
    return result.rows.length > 0;
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
    await pool.query(
      'INSERT INTO usuarios (id, alias, fecha_registro, estado) VALUES ($1, $2, NOW(), $3)',
      [userId, alias, ESTADOS_USUARIO.REGISTRADO]
    );
    return true;
  } catch (error) {
    console.error('Error registering user:', error.message);
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

  console.log(`📩 Mensaje recibido (${text.length} chars)`);

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
        await safeReply(message, `✅ ¡Perfecto ${alias}! Soy *BotMundialista*, tu asistente de fútbol y apuestas.\n\nEscribe *ayuda* para ver qué puedo hacer.`);
      }
      return;
    }

    // Primer mensaje - pedir alias
    userStates.set(userId, { value: ESTADOS_USUARIO.ESPERANDO_ALIAS, lastAccess: Date.now() });
    await safeReply(message, '¡Hola! 👋 Soy *BotMundialista*, tu asistente de fútbol.\n\n¿Cómo quieres que te llame? Escribe tu alias:');
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
      console.error('Error processing image:', error);
      await safeReply(message, '⚠️ No pude procesar la imagen. Intenta de nuevo.');
      return;
    }
  }

  // === USER REGISTERED - PROCESS MESSAGE ===
  const parsed = parse(text);
  console.log(`🎯 Intent: ${parsed.intent}`);

  let response = '';

  try {
    switch (parsed.intent) {
      case INTENTOS.SALUDO:
        response = `¡Hola ${user.alias}! 👋🏆 Bienvenido al asistente del *Mundial 2026*\n\n` +
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
        response = `📖 *COMANDOS - MUNDIAL 2026*\n\n` +
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
        response = await matchHandler.getPartidosHoy(parsed);
        break;

      case INTENTOS.PARTIDOS_FECHA:
        response = await matchHandler.getPartidosFecha(parsed.fecha);
        break;

      case INTENTOS.RESULTADO:
        response = await matchHandler.getResultadoEquipo(parsed.equipo);
        break;

      case INTENTOS.RESULTADO_VS:
        response = await matchHandler.getResultadoVS(parsed.home, parsed.away);
        break;

      case INTENTOS.INFO_EQUIPO:
        response = await teamHandler.getInfoEquipo(parsed.equipo);
        break;

      case INTENTOS.ESTADISTICA:
        response = await statsHandler.getEstadisticas(parsed);
        break;

      case INTENTOS.TABLA:
        response = await tableHandler.getTabla(parsed.liga);
        break;

      case INTENTOS.TABLA_MUNDIAL:
        response = await tableHandler.getTablaMundial();
        break;

      case INTENTOS.TABLA_GRUPO:
        response = await tableHandler.getTablaGrupoMundial(parsed.grupo);
        break;

      case INTENTOS.ANALISIS:
        if (parsed.home && parsed.away) {
          response = await bettingHandler.analizarEnfrentamiento(parsed.home, parsed.away);
        } else if (parsed.equipo) {
          response = await bettingHandler.analizarEquipo(parsed.equipo);
        } else {
          response = '⚠️ Indica dos equipos para analizar. Ej: "Analiza Brasil vs Argentina"';
        }
        break;

      case INTENTOS.SEGUIR_EQUIPO:
        response = await teamHandler.seguirEquipo(userId, parsed.equipo);
        break;

      case INTENTOS.DEJAR_SEGUIR:
        response = await teamHandler.dejarSeguirEquipo(userId, parsed.equipo);
        break;

      case INTENTOS.MIS_EQUIPOS:
        response = await teamHandler.getEquiposSeguidos(userId);
        break;

      default:
        response = `🤔 No entendí "${text}".\n\nEscribe *ayuda* para ver los comandos disponibles.`;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    response = '⚠️ Ocurrió un error procesando tu consulta. Intenta de nuevo.';
  }

  // Guardar en historial (ignorar si DB no disponible)
  if (dbAvailable) {
    try {
      await pool.query(
        'INSERT INTO historial_consultas (id_usuario, consulta, tipo, respuesta, fecha) VALUES ($1, $2, $3, $4, NOW())',
        [userId, text, parsed.intent, response]
      );
    } catch (error) {
      console.error('Error saving query:', error.message);
    }
  }

  // Send response (con manejo de errores de Puppeteer)
  try {
    await message.reply(response);
  } catch (replyError) {
    console.error('Error enviando respuesta (posible desconexión de WhatsApp):', replyError.message);
  }
}

module.exports = messageHandler;