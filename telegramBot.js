// BotMundialista - Telegram Bot (usando API directa)
require('dotenv').config();
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const messageHandler = require('./handlers/messageHandler');
const matchSearch = require('./services/matchSearch');
const cosmos = require('./database/cosmos');
const followHandler = require('./handlers/followHandler');
const conversationalHandler = require('./handlers/conversationalHandler');
const mundialista365 = require('./handlers/mundialista365Handler');
const mundialistaStats = require('./handlers/mundialistaStatsHandler');
const cache = require('./services/mundialCache');
const matchHandler = require('./handlers/matchHandler');
const { getAthletePhotoUrl, getAthleteThumbUrl, getCountryFlagUrl, getTeamBadgeUrl } = require('./services/images');
const { pool, testConnection } = require('./database/connection');
const userStorage = require('./utils/userStorage');
const telegramNotifier = require('./services/telegramNotifier');
const conversationContext = require('./services/conversationContext');

if (process.env.ENABLE_LIVE_NOTIFIER === 'true') {
  try {
    telegramNotifier.registerBot({ sendMessage }, 'telegram');
    telegramNotifier.attach();
  } catch (e) {
    console.error('[telegramBot] error attaching notifier:', e.message);
  }
}

// Token del bot de Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Flag para saber si la DB está disponible
let dbAvailable = false;

// Mini servidor HTTP para health checks + webhook de Telegram
const PORT = process.env.PORT || 8080;
const WEBHOOK_PATH = '/webhook';
const WEBHOOK_URL = `https://botmundialista.azurewebsites.net${WEBHOOK_PATH}`;
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
  } else if (url === WEBHOOK_PATH && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200);
      res.end();
      try {
        const update = JSON.parse(body);
        handleWebhookUpdate(update).catch(e => console.error('[webhook] handler error:', e.message));
      } catch (e) {
        console.error('[webhook] body parse error:', e.message);
      }
    });
  } else if (url.startsWith('/admin')) {
    handleAdminRoute(req, res, url);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});

/**
 * Maneja las rutas del panel de administración (/admin)
 */
async function handleAdminRoute(req, res, url) {
  const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Servir index.html para /admin y /admin/
  if (pathname === '/admin' || pathname === '/admin/') {
    const indexPath = path.join(__dirname, 'admin', 'public', 'index.html');
    try {
      const html = fs.readFileSync(indexPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end('Error reading admin page');
    }
    return;
  }

  // API endpoints
  if (pathname.startsWith('/admin/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // POST: rename user
    if (req.method === 'POST' && pathname === '/admin/api/users/rename') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { id, alias } = JSON.parse(body);
          if (!id || !alias) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'id and alias required' }));
            return;
          }
          await pool.query('UPDATE usuarios SET alias = $1 WHERE id = $2', [alias, id]);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Build platform filter
    const platform = parsedUrl.searchParams.get('platform') || 'telegram';
    const userCond = platform === 'whatsapp' ? "LIKE '%@%'" : platform === 'all' ? 'IS NOT NULL' : "NOT LIKE '%@%'";
    const userFilter = `id ${userCond}`;
    const uFilter = `u.id ${userCond}`;
    const hFilter = `h.id_usuario ${userCond}`;

    try {
      let data;
      switch (pathname) {
        case '/admin/api/stats': {
          const [users, queries, todayQueries, teamsFollowed] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total FROM usuarios WHERE ${userFilter}`),
            pool.query(`SELECT COUNT(*) as total FROM historial_consultas h WHERE ${hFilter}`),
            pool.query(`SELECT COUNT(*) as total FROM historial_consultas h WHERE ${hFilter} AND DATE(fecha) = CURRENT_DATE`),
            pool.query(`SELECT COUNT(*) as total FROM equipos_seguidos e JOIN usuarios u ON e.id_usuario = u.id WHERE ${uFilter}`)
          ]);
          data = {
            totalUsers: parseInt(users.rows[0].total),
            totalQueries: parseInt(queries.rows[0].total),
            teamsFollowed: parseInt(teamsFollowed.rows[0].total),
            todayQueries: parseInt(todayQueries.rows[0].total)
          };
          break;
        }
        case '/admin/api/users': {
          const result = await pool.query(`SELECT id, alias, fecha_registro FROM usuarios WHERE ${userFilter} ORDER BY fecha_registro DESC LIMIT 50`);
          data = result.rows;
          break;
        }
        case '/admin/api/queries': {
          const limit = parseInt(parsedUrl.searchParams.get('limit')) || 50;
          const offset = parseInt(parsedUrl.searchParams.get('offset')) || 0;
          const search = parsedUrl.searchParams.get('search') || '';
          let where = hFilter;
          const params = [];
          let paramIdx = 1;
          if (search) {
            where += ` AND (h.consulta ILIKE $${paramIdx} OR u.alias ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
          }
          params.push(limit, offset);
          const result = await pool.query(
            `SELECT h.id, h.consulta, h.tipo, h.respuesta, h.fecha, u.alias
             FROM historial_consultas h
             JOIN usuarios u ON h.id_usuario = u.id
             WHERE ${where}
             ORDER BY h.fecha DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, params
          );
          data = result.rows;
          break;
        }
        case '/admin/api/followed-teams': {
          const result = await pool.query(
            `SELECT e.nombre_equipo, u.alias, e.fecha_seguimiento
             FROM equipos_seguidos e
             JOIN usuarios u ON e.id_usuario = u.id
             WHERE ${uFilter}
             ORDER BY e.fecha_seguimiento DESC
             LIMIT 100`
          );
          data = result.rows;
          break;
        }
        case '/admin/api/queries-by-type': {
          const result = await pool.query(
            `SELECT tipo, COUNT(*) as total
             FROM historial_consultas h
             WHERE ${hFilter}
             GROUP BY tipo
             ORDER BY total DESC`
          );
          data = result.rows;
          break;
        }
        case '/admin/api/apuestas': {
          const limit = parseInt(parsedUrl.searchParams.get('limit')) || 50;
          const result = await pool.query(
            `SELECT a.id, a.id_usuario, a.partido_extrado, a.partido_normalizado,
                    a.marcador_local, a.marcador_visitante, a.estado, a.resultado_final,
                    a.fecha_creacion, a.fecha_partido, a.fecha_cierre,
                    u.alias
             FROM apuestas a
             JOIN usuarios u ON a.id_usuario = u.id
             ORDER BY a.fecha_creacion DESC
             LIMIT $1`, [limit]
          );
          data = result.rows;
          break;
        }
        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error('[admin] Error en', pathname, error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Database error' }));
    }
    return;
  }

  // Servir archivos estáticos de admin/public/
  if (pathname.startsWith('/admin/public/')) {
    const relPath = pathname.replace('/admin/public/', '');
    const filePath = path.join(__dirname, 'admin', 'public', relPath);
    try {
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.html': 'text/html',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
      };
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(content);
    } catch (e) {
      console.error('[admin] static file error:', filePath, e.message);
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

/**
 * Hace una solicitud a la API de Telegram
 */
async function telegramRequest(method, params = {}, timeoutMs = 60000) {
  const url = new URL(`${API_URL}/${method}`);
  const body = JSON.stringify(params);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            console.error(`[Telegram API] ${method} falló:`, parsed.description);
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Telegram API (${method}): respuesta no-JSON: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Telegram API (${method}): timeout after ${timeoutMs}ms`)); });
    req.write(body);
    req.end();
  });
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

async function sendPhoto(chatId, photoUrl, caption = '', options = {}) {
  return telegramRequest('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'Markdown',
    ...options
  });
}

async function sendMediaGroup(chatId, media, options = {}) {
  return telegramRequest('sendMediaGroup', {
    chat_id: chatId,
    media,
    ...options
  });
}

/**
 * Maneja comandos de Telegram (que empiezan con /)
 */
async function handleCommand(chatId, text, userName, userId) {
  const cmd = text.toLowerCase();
  const storedAlias = userStorage.getAlias(userId);
  const alias = storedAlias || userName || 'Usuario';

  switch (cmd) {
    case '/start':
    case '/inicio':
      await sendMessage(chatId,
        `🏆 *BotMundialista* - Asistente del Mundial 2026\n\n` +
        `¡Hola ${alias}! 👋 Soy tu asistente de fútbol.\n\n` +
        `📱 *Comandos básicos:*\n` +
        `  /start · /help - Iniciar / ver ayuda\n` +
        `  /partidos - Partidos de hoy\n` +
        `  /manana - Partidos de mañana\n` +
        `  /tabla - Tabla del Mundial\n` +
        `  /grupo [A-L] - Tabla de grupo _(ej: /grupo A)_\n` +
        `  /resultado [equipo] - Resultado _(ej: /resultado brasil)_\n` +
        `  /analizar [eq1] vs [eq2] - Análisis _(ej: /analizar brasil vs argentina)_\n` +
        `  /info [equipo] · /seguir [equipo] - Info / seguir equipo\n` +
        `  /cambiarusuario [nombre] - Cambiar apodo\n\n` +
        `🎯 *Tips, cuotas y tendencias:*\n` +
        `  /fixture - Próximos partidos del Mundial\n` +
        `  /outrights - Cuotas de campeón, goleador y más\n` +
        `  /odds <gameId> - Cuotas detalladas de un partido\n` +
        `  /tip [eq1] vs [eq2] - Tip con confianza _(ej: /tip brasil vs argentina)_\n` +
        `  /tendencias - Top tendencias + cuotas del Mundial\n` +
        `  /tendencias [eq1] vs [eq2] - Trends de un partido\n` +
        `  /predicciones <gameId> - Predicciones de la comunidad\n\n` +
        `📡 *Stats y partidos:*\n` +
        `  /partidos - Partidos de hoy (tips + trends + odds)\n` +
        `  /live - Partidos en vivo con stats y odds\n` +
        `  /stats-vivo <gameId> - Stats del último snapshot\n` +
        `  /alineacion <gameId> - Titulares y formación\n` +
        `  /previa <gameId> - Pre-match stats\n` +
        `  /h2h <gameId> - Historial entre los equipos\n\n` +
        `📰 *Contenido del Mundial:*\n` +
        `  /noticias - Últimas noticias\n` +
        `  /noticias [equipo] - Noticias de un equipo _(ej: /noticias brasil)_\n` +
        `  /equipoideal - Team of the Week\n` +
        `  /bracket - Llaves eliminatorias\n` +
        `  /bracket grupos - Fase de grupos\n` +
        `  /historial - Campeones 1930-2022\n` +
        `  /historial 2022 - Final de ese año\n` +
        `  /historial brasil - Ediciones del equipo\n` +
        `  /goleadores - Top goleadores (con foto)\n` +
        `  /jugador <nombre> - Foto + info del jugador\n\n` +
        `💡 También podés escribir en lenguaje natural:\n` +
        `  "¿Cómo quedó Brasil?"\n` +
        `  "Tabla del grupo C"\n` +
        `  "Dame info de Alemania"`
      );
      return true;

    case '/help':
    case '/ayuda':
      await sendMessage(chatId,
        `📖 *COMANDOS - MUNDIAL 2026*\n\n` +
        `⚽ *Partidos:*\n` +
        `  /partidos - Partidos de hoy\n` +
        `  /manana - Partidos de mañana\n` +
        `  /resultado [equipo] - Último resultado _(ej: /resultado brasil)_\n` +
        `  /analizar [eq1] vs [eq2] - Análisis _(ej: /analizar brasil vs argentina)_\n` +
        `  /proximos [equipo] · /siguiente [equipo] - Próximos partidos\n\n` +
        `🏆 *Tablas:*\n` +
        `  /tabla - Tabla del Mundial\n` +
        `  /grupo [A-L] - Grupo específico _(ej: /grupo A)_\n\n` +
        `👥 *Equipos:*\n` +
        `  /info [equipo] - Info del equipo\n` +
        `  /seguir [equipo] - Seguir equipo\n` +
        `  /cambiarusuario [nombre] - Cambiar apodo\n` +
        `  /yo · /reset - Perfil / borrar datos\n\n` +
        `🎯 *Tips, cuotas y tendencias:*\n` +
        `  /fixture - Próximos partidos del Mundial\n` +
        `  /outrights - Cuotas de campeón, goleador y más\n` +
        `  /odds <gameId> - Cuotas detalladas de un partido\n` +
        `  /tip [eq1] vs [eq2] - Tip con % de confianza\n` +
        `  /tendencias - Top tendencias + cuotas outright\n` +
        `  /tendencias [eq1] vs [eq2] - Trends de un partido\n` +
        `  /predicciones <gameId> - Predicciones comunidad\n\n` +
        `📡 *Stats en vivo:*\n` +
        `  /live - Partidos en vivo (con stats + odds)\n` +
        `  /stats-vivo <gameId> - Stats del último snapshot\n` +
        `  /alineacion <gameId> - Titulares y formación\n` +
        `  /previa <gameId> - Pre-match stats\n` +
        `  /h2h <gameId> - Historial entre los equipos\n\n` +
        `📰 *Contenido del Mundial:*\n` +
        `  /noticias - Últimas noticias del Mundial\n` +
        `  /noticias [equipo] - Noticias de un equipo\n` +
        `  /equipoideal - Team of the Week (formación, ratings)\n` +
        `  /bracket - Llaves eliminatorias\n` +
        `  /bracket grupos - Fase de grupos\n` +
        `  /historial - Todos los campeones\n` +
        `  /historial [año] - Final específica _(ej: /historial 2022)_\n` +
        `  /historial [equipo] - Ediciones del equipo _(ej: /historial brasil)_\n` +
        `  /goleadores - Ranking de goleadores\n\n` +
        `💡 _También entendés: "Cómo le fue a X", "Brasil vs Francia", "Estadísticas de X", "Tabla de la Premier"…_`
      );
      return true;

    case '/cambiarnombre':
    case '/cambiarnombre@botmundialistabot':
    case '/cambiarusuario':
    case '/cambiarusuario@botmundialistabot':
      const argNombre = command.replace(/^\/(cambiarnombre|cambiarusuario)(@\w+)?/i, '').trim();
      if (!argNombre) {
        await sendMessage(chatId,
          `✏️ *Cambiar nombre*\n\n` +
          `Uso: \`/cambiarusuario TuNombre\`\n\n` +
          `Tu apodo actual: *${alias}*\n` +
          `Máximo ${userStorage.MAX_LEN} caracteres.\n\n` +
          `Otros comandos: /mialias (ver) · /help (ayuda)`
        );
        return true;
      }
      const r = await userStorage.setAlias(userId, argNombre);
      if (!r.ok) {
        await sendMessage(chatId, `⚠️ No pude cambiar tu nombre: ${r.reason}`);
      } else {
        const syncMsg = r.synced
          ? '✅ Guardado en Supabase'
          : '💾 Guardado localmente (Supabase no disponible)';
        await sendMessage(chatId,
          `✅ *Listo*\n\n` +
          `Tu nuevo apodo es: *${r.alias}*\n` +
          `${syncMsg}\n\n` +
          `A partir de ahora te saludaré como "${r.alias}".`
        );
      }
      return true;

    case '/mialias':
      const currentAlias = userStorage.getAlias(userId);
      if (currentAlias) {
        await sendMessage(chatId,
          `👤 *Tu apodo actual*\n\n` +
          `Apodo: *${currentAlias}*\n` +
          `ID de Telegram: \`${userId}\`\n\n` +
          `Para cambiarlo: \`/cambiarnombre NuevoNombre\``
        );
      } else {
        await sendMessage(chatId,
          `👤 Aún no tienes apodo personalizado.\n\n` +
          `Tu nombre actual es: *${userName || 'Usuario'}* (de Telegram)\n\n` +
          `Para crear uno: \`/cambiarnombre TuNombre\``
        );
      }
      return true;

    case '/partidos':
    case '/hoy': {
      try {
        const text = await matchHandler.getPartidosHoy();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).replace(/-/g, '');
        const games = await cache.getWorldCupGames({ date: today });
        if (games && games.length > 0) {
          const keyboard = buildGameKeyboard(games, ['tip', 'trends', 'odds']);
          await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
        } else {
          await sendMessage(chatId, text);
        }
      } catch (e) {
        console.error('[partidos] error:', e);
        await sendMessage(chatId, '⚠️ Error al obtener los partidos.');
      }
      return true;
    }

    case '/manana':
    case '/mañana':
    case '/tomorrow': {
      const hoyCR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
      const [y, m, d] = hoyCR.split('-').map(Number);
      const tomorrow = new Date(y, m - 1, d + 1).toISOString().split('T')[0].replace(/-/g, '');
      try {
        const matches = await cache.getWorldCupGames({ date: tomorrow });
        if (!matches || matches.length === 0) {
          await sendMessage(chatId,
            `📅 *MUNDIAL — MAÑANA*\n\n🟢 No hay partidos del Mundial programados para mañana.`);
          return true;
        }
        const porGrupo = {};
        matches.forEach(m => {
          const letra = (m.stageName || '').match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() || '?';
          if (!porGrupo[letra]) porGrupo[letra] = [];
          porGrupo[letra].push(m);
        });
        let msg = `📅 *MUNDIAL — MAÑANA*\n\n`;
        Object.keys(porGrupo).sort().forEach(g => {
          msg += `📋 *GRUPO ${g}*\n`;
          porGrupo[g].forEach(m => {
            const home = m.homeCompetitor?.name || m.homeTeam || '?';
            const away = m.awayCompetitor?.name || m.awayTeam || '?';
            msg += `⚽ ${home} vs ${away}`;
            const t = m.startTime || m.time || '';
            if (t) msg += `  _(${t.includes('T') ? t.split('T')[1]?.slice(0,5) : t})_`;
            msg += '\n';
          });
          msg += '\n';
        });
        const keyboard = buildGameKeyboard(matches, ['tip', 'trends', 'odds']);
        await sendMessage(chatId, msg.trim(), { reply_markup: { inline_keyboard: keyboard } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ No pude obtener partidos de mañana.');
      }
      return true;
    }

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

    case '/mundial': {
      await sendMessage(chatId,
        `🏆 *MUNDIAL 2026*\n\n` +
        `🌎 *Sede:* EE.UU. · Canadá · México\n` +
        `📅 *Fechas:* 11 junio – 19 julio 2026\n` +
        `👥 *Equipos:* 48 selecciones\n` +
        `🗂 *Grupos:* 12 (A a L)\n` +
        `⚽ *Partidos:* 104 (64 fase grupos + 32 eliminación + 8 clasificación)\n` +
        `🥇 *Final:* 19 jul 2026 — MetLife Stadium, NJ\n\n` +
        `📋 *Comandos relacionados:*\n` +
        `• /grupo [A-L] — Tabla de un grupo\n` +
        `• /partidos — Partidos de hoy\n` +
        `• /manana — Partidos de mañana\n` +
        `• /goleadores — Top goleadores del Mundial`
      );
      return true;
    }

    case '/yo':
    case '/perfil':
    case '/profile':
      try {
        const alias = userStorage.getAlias(userId);
        let followedCount = 0;
        let queryCount = 0;
        try {
          const f = await pool.query(
            `SELECT COUNT(*) FROM equipos_seguidos WHERE id_usuario = $1`,
            [userId]
          );
          followedCount = parseInt(f.rows[0]?.count || 0, 10);
          const h = await pool.query(
            `SELECT COUNT(*) FROM historial_consultas WHERE id_usuario = $1`,
            [userId]
          );
          queryCount = parseInt(h.rows[0]?.count || 0, 10);
        } catch (e) { /* DB opcional */ }
        await sendMessage(chatId,
          `👤 *TU PERFIL*\n\n` +
          `🏷  *Apodo:* ${alias || userName || 'Sin definir'}\n` +
          `🆔 *ID:* \`${userId}\`\n` +
          `⭐ *Equipos seguidos:* ${followedCount}\n` +
          `💬 *Consultas realizadas:* ${queryCount}\n\n` +
          `📋 *Comandos útiles:*\n` +
          `• /misfavoritos — Ver equipos seguidos\n` +
          `• /cambiarusuario [nombre] — Cambiar apodo\n` +
          `• /reset — Borrar todos mis datos`
        );
      } catch (e) {
        await sendMessage(chatId, '⚠️ No pude cargar tu perfil.');
      }
      return true;

    case '/reset': {
      await sendMessage(chatId,
        `⚠️ *Borrar todos mis datos*\n\n` +
        `Esto eliminará:\n` +
        `• Tu apodo personalizado\n` +
        `• Todos los equipos que sigues\n` +
        `• Tu historial de consultas\n\n` +
        `Para confirmar, escribí: *BORRAR TODO*\n` +
        `Para cancelar, enviá cualquier otro mensaje.`);
      userStorage.markPendingReset(userId);
      return true;
    }

    default:
      // Comandos con argumentos: /resultado, /analizar, /info, /seguir
      if (cmd.startsWith('/resultado ')) {
        const equipoText = text.replace('/resultado ', '').replace('/Resultado ', '');
        const vsMatch = equipoText.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        let photoUrls = null;
        let vsHomeName = null, vsAwayName = null;
        if (vsMatch) {
          vsHomeName = vsMatch[1].trim();
          vsAwayName = vsMatch[2].trim();
          const [homeTeam, awayTeam] = await Promise.all([
            cache.getTeamByName(vsHomeName),
            cache.getTeamByName(vsAwayName)
          ]);
          const homeBadge = homeTeam?.id ? getTeamBadgeUrl(homeTeam.id, homeTeam.imageVersion) : null;
          const awayBadge = awayTeam?.id ? getTeamBadgeUrl(awayTeam.id, awayTeam.imageVersion) : null;
          if (homeBadge && awayBadge) photoUrls = [homeBadge, awayBadge];
          else if (homeBadge) photoUrls = [homeBadge];
          else if (awayBadge) photoUrls = [awayBadge];
        } else {
          const team = await cache.getTeamByName(equipoText.trim());
          if (team?.id) photoUrls = [getTeamBadgeUrl(team.id, team.imageVersion)];
        }
        const msgRes = {
          from: chatId.toString(),
          body: `como quedo ${equipoText}`,
          hasMedia: false,
          reply: async (t) => {
            if (photoUrls && photoUrls.length === 2) {
              await sendMediaGroup(chatId, photoUrls.map(u => ({ type: 'photo', media: u })));
              await sendMessage(chatId, t);
            } else if (photoUrls && photoUrls.length === 1) {
              await sendPhoto(chatId, photoUrls[0], t);
            } else {
              await sendMessage(chatId, t);
            }
            if (vsHomeName && vsAwayName) {
              const game = await matchSearch.findGameByTeams(vsHomeName, vsAwayName).catch(() => null);
              if (game?.id) {
                await sendMessage(chatId, '📊 Acciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['tip', 'trends', 'odds']) } });
              }
            }
          }
        };
        await messageHandler(null, msgRes);
        return true;
      }

      if (cmd === '/analizar' || cmd === '/analizar@botmundialistabot') {
        await sendMessage(chatId,
          `📊 *Analizar partido*\n\n` +
          `Uso: \`/analizar [equipo1] vs [equipo2]\`\n\n` +
          `Ejemplos:\n` +
          `• /analizar Brasil vs Francia\n` +
          `• /analizar Argentina vs Alemania\n\n` +
          `Genero estadísticas, forma reciente y pronóstico.`
        );
        return true;
      }

      if (cmd.startsWith('/analizar ')) {
        const vsText = text.replace('/analizar ', '').replace('/Analizar ', '');
        const vsM = vsText.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        const msgAna = {
          from: chatId.toString(),
          body: `analiza ${vsText}`,
          hasMedia: false,
          reply: async (t) => {
            await sendMessage(chatId, t);
            if (vsM) {
              const game = await matchSearch.findGameByTeams(vsM[1].trim(), vsM[2].trim()).catch(() => null);
              if (game?.id) {
                await sendMessage(chatId, '📊 Acciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['h2h', 'odds']) } });
              }
            }
          }
        };
        await messageHandler(null, msgAna);
        return true;
      }

      // Aliases de stats: /goles, /corners, /posesion, /tarjetas
      const statAliases = [
        { cmd: '/goles', tipo: 'goles' },
        { cmd: '/corners', tipo: 'córners' },
        { cmd: '/posesion', tipo: 'posesión' },
        { cmd: '/posesión', tipo: 'posesión' },
        { cmd: '/tarjetas', tipo: 'tarjetas' },
        { cmd: '/goleador', tipo: 'goles' },
      ];
      for (const alias of statAliases) {
        if (cmd === alias.cmd || cmd === alias.cmd + '@botmundialistabot') {
          await sendMessage(chatId,
            `📊 *${alias.cmd.replace('/', '').toUpperCase()} [equipo]*\n\n` +
            `Uso: \`${alias.cmd} [equipo]\`\n\n` +
            `Ejemplos:\n` +
            `• ${alias.cmd} Brasil\n` +
            `• ${alias.cmd} Argentina\n\n` +
            `Te muestro ${alias.tipo} de los últimos partidos.`
          );
          return true;
        }
        if (cmd.startsWith(alias.cmd + ' ')) {
          const equipo = text.replace(new RegExp(`^${alias.cmd}(?:@\\w+)? `, 'i'), '').trim();
          const msgStat = {
            from: chatId.toString(),
            body: `${alias.tipo} de ${equipo}`,
            hasMedia: false,
            reply: async (t) => await sendMessage(chatId, t)
          };
          await messageHandler(null, msgStat);
          return true;
        }
      }

      // /racha [equipo] → muestra racha W/L y forma
      if (cmd === '/racha' || cmd === '/racha@botmundialistabot') {
        await sendMessage(chatId,
          `🔥 *RACHA [equipo]*\n\n` +
          `Uso: \`/racha [equipo]\`\n\n` +
          `Ejemplos:\n` +
          `• /racha Brasil\n` +
          `• /racha Argentina\n\n` +
          `Te muestro la racha actual (W = victorias, L = derrotas).`
        );
        return true;
      }
      if (cmd.startsWith('/racha ')) {
        const equipo = text.replace(/^\/racha(?:@\w+)? /i, '').trim();
        const team = await cache.getTeamByName(equipo);
        const photoUrl = team?.id ? getTeamBadgeUrl(team.id, team.imageVersion) : null;
        const msgSt = {
          from: chatId.toString(),
          body: `cual es la racha de ${equipo}`,
          hasMedia: false,
          reply: async (t) => {
            if (photoUrl) {
              await sendPhoto(chatId, photoUrl, t);
            } else {
              await sendMessage(chatId, t);
            }
          }
        };
        await messageHandler(null, msgSt);
        return true;
      }

      // /proximos [equipo] y /siguiente [equipo]
      if (cmd === '/proximos' || cmd === '/siguiente' ||
          cmd === '/proximos@botmundialistabot' || cmd === '/siguiente@botmundialistabot') {
        await sendMessage(chatId,
          `📅 *${cmd.startsWith('/siguiente') ? 'SIGUIENTE' : 'PRÓXIMOS'} [equipo]*\n\n` +
          `Uso: \`${cmd} [equipo]\`\n\n` +
          `• /proximos Brasil — Próximos 5 partidos\n` +
          `• /siguiente Argentina — Solo el siguiente partido`
        );
        return true;
      }
      if (cmd.startsWith('/proximos ') || cmd.startsWith('/siguiente ')) {
        const limit = cmd.startsWith('/siguiente') ? 1 : 5;
        const equipo = text.replace(/^\/(proximos|siguiente)(?:@\w+)? /i, '').trim();
        try {
          const team = await cache.getTeamByName(equipo);
          if (!team) {
            await sendMessage(chatId, `⚠️ No encontré al equipo "${equipo}".`);
            return true;
          }
          const allMatches = await cache.getRecentWorldCupMatchesByTeam(team.id);
          const now = Date.now();
          const upcoming = allMatches
            .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
            .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
            .slice(0, limit);
          if (!upcoming || upcoming.length === 0) {
            await sendMessage(chatId, `📅 No hay partidos próximos para *${team.name}*.`);
            return true;
          }
          let msg = `📅 *${cmd.startsWith('/siguiente') ? 'PRÓXIMO' : 'PRÓXIMOS'} PARTIDO${limit > 1 ? 'S' : ''} - ${team.name.toUpperCase()}*\n\n`;
          upcoming.forEach(m => {
            const date = new Date(m.date).toLocaleDateString('es-ES', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            });
            const tournament = m.leagueName || m.tournament || 'Competición';
            const isHome = m.homeTeamId == team.id;
            msg += `📅 ${date}\n`;
            msg += `  ${m.homeTeam} vs ${m.awayTeam}\n`;
            msg += `  ${isHome ? '🟢 LOCAL' : '✈️ VISITANTE'} · 🏆 ${tournament}\n\n`;
          });
          const badgeUrl = team?.id ? getTeamBadgeUrl(team.id, team.imageVersion) : null;
          if (badgeUrl) {
            await sendPhoto(chatId, badgeUrl, `🏆 ${team.name}`);
          }
          await sendMessage(chatId, msg.trim());
          if (upcoming.length > 0) {
            await sendMessage(chatId, '🎲 Ver cuotas:', { reply_markup: { inline_keyboard: buildGameKeyboard(upcoming, ['odds']) } });
          }
        } catch (e) {
          await sendMessage(chatId, '⚠️ No pude obtener próximos partidos.');
        }
        return true;
      }

      // /dejarseguir [equipo]
      if (cmd === '/dejarseguir' || cmd === '/dejarseguir@botmundialistabot') {
        await sendMessage(chatId,
          `🚫 *DEJAR DE SEGUIR [equipo]*\n\n` +
          `Uso: \`/dejarseguir [equipo]\`\n\n` +
          `• /dejarseguir Brasil\n` +
          `• /dejarseguir Argentina`
        );
        return true;
      }
      if (cmd.startsWith('/dejarseguir ') || cmd.startsWith('/dejar_seguir ')) {
        const equipo = text.replace(/^\/(dejarseguir|dejar_seguir)(?:@\w+)? /i, '').trim();
        const msgNoSeg = {
          from: chatId.toString(),
          body: `dejar de seguir ${equipo}`,
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgNoSeg);
        return true;
      }
      // Sin argumentos especiales: enviar el mensaje al messageHandler como texto
      if (/^\/dejarseguir(?:@\w+)?$/i.test(cmd)) {
        await sendMessage(chatId,
          `🚫 *DEJAR DE SEGUIR [equipo]*\n\nUso: \`/dejarseguir [equipo]\``
        );
        return true;
      }

      // /misfavoritos, /misequipos, /misfavorito
      if (cmd === '/misfavoritos' || cmd === '/misequipos' || cmd === '/misfavorito' ||
          cmd === '/misfavoritos@botmundialistabot') {
        const msgList = {
          from: chatId.toString(),
          body: 'mis equipos',
          hasMedia: false,
          reply: async (t) => await sendMessage(chatId, t)
        };
        await messageHandler(null, msgList);
        return true;
      }

      // /dondever [equipo]
      if (cmd === '/dondever' || cmd === '/dondever@botmundialistabot') {
        await sendMessage(chatId,
          `📺 *DÓNDE VER [equipo]*\n\n` +
          `Uso: \`/dondever [equipo]\`\n\n` +
          `Por ahora te muestro dónde se juega (estadio) el próximo partido.`
        );
        return true;
      }
      if (cmd.startsWith('/dondever ')) {
        const equipo = text.replace(/^\/dondever(?:@\w+)? /i, '').trim();
        try {
          const team = await cache.getTeamByName(equipo);
          if (!team) {
            await sendMessage(chatId, `⚠️ No encontré al equipo "${equipo}".`);
            return true;
          }
          const allMatches = await cache.getRecentWorldCupMatchesByTeam(team.id);
          const now = Date.now();
          const upcoming = allMatches
            .filter((m) => (m.homeCompetitor?.score == null || m.homeCompetitor?.score < 0) && new Date(m.startTime || m.date || 0).getTime() >= now - 86400000)
            .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
            .slice(0, 1);
          if (!upcoming || upcoming.length === 0) {
            await sendMessage(chatId, `📺 No hay partidos próximos de *${team.name}* para mostrar sede.`);
            return true;
          }
          const m = upcoming[0];
          await sendMessage(chatId,
            `📺 *PRÓXIMO PARTIDO - ${team.name.toUpperCase()}*\n\n` +
            `${m.homeTeam} vs ${m.awayTeam}\n` +
            `📅 ${new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
            `🏆 ${m.leagueName || m.tournament || 'Competición'}\n\n` +
            `ℹ️ Los derechos de transmisión varían por país. Te sugiero consultar la guía de TV de tu país (ej: "TyC Sports" o "ESPN" en Argentina, "TUDN" en México, "Movistar+" en España).`
          );
          if (m.id) {
            await sendMessage(chatId, '🎲 Cuotas:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(m.id, ['odds']) } });
          }
        } catch (e) {
          await sendMessage(chatId, '⚠️ No pude obtener info.');
        }
        return true;
      }

      if (cmd.startsWith('/info ')) {
        const equipo = text.replace(/^\/info(?:@\w+)? /i, '').trim();
        const team = await cache.getTeamByName(equipo);
        let photoUrl = null;
        if (team && team.id) {
          photoUrl = getTeamBadgeUrl(team.id, team.imageVersion) || getCountryFlagUrl(team.countryId);
        } else if (team && team.countryId) {
          photoUrl = getCountryFlagUrl(team.countryId);
        }
        const msgInfo = {
          from: chatId.toString(),
          body: `dame info de ${equipo}`,
          hasMedia: false,
          reply: async (t) => {
            if (photoUrl) {
              await sendPhoto(chatId, photoUrl, t);
            } else {
              await sendMessage(chatId, t);
            }
            if (team?.id) {
              const allM = await cache.getRecentWorldCupMatchesByTeam(team.id).catch(() => []);
              const now = Date.now();
              const next = allM.filter((gm) => new Date(gm.startTime || gm.date || 0) > now).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)).slice(0, 1);
              if (next.length && next[0].id) {
                await sendMessage(chatId, '🎲 Cuotas del próximo partido:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(next[0].id, ['odds']) } });
              }
            }
          }
        };
        await messageHandler(null, msgInfo);
        return true;
      }

      if (cmd.startsWith('/seguir ')) {
        const equipo = text.replace('/seguir ', '').replace('/Seguir ', '');
        const team = await cache.getTeamByName(equipo).catch(() => null);
        const msgSeg = {
          from: chatId.toString(),
          body: `seguir ${equipo}`,
          hasMedia: false,
          reply: async (t) => {
            await sendMessage(chatId, t);
            if (team?.id) {
              const allM = await cache.getRecentWorldCupMatchesByTeam(team.id).catch(() => []);
              const now = Date.now();
              const next = allM.filter((gm) => new Date(gm.startTime || gm.date || 0) > now).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)).slice(0, 3);
              if (next.length) {
                await sendMessage(chatId, '🎲 Próximos partidos:', { reply_markup: { inline_keyboard: buildGameKeyboard(next, ['odds']) } });
              }
            }
          }
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
        try {
          const standings = await cache.getWorldCupStandings();
          const standing = standings.find(s => {
            const letra = s.name?.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase();
            return letra === grupo;
          });
          if (standing?.teams?.length > 0) {
            const media = [];
            for (const t of standing.teams) {
              const team = await cache.getTeamByName(t.name);
              if (team?.id) {
                const url = getTeamBadgeUrl(team.id, team.imageVersion);
                if (url) media.push({ type: 'photo', media: url });
              }
            }
            if (media.length > 0) await sendMediaGroup(chatId, media);
          }
        } catch (e) { /* ignore badge errors */ }
        return true;
      }

      // ===========================================================
      // FASE 1.5: Fixtures y Outrights
      // ===========================================================

      // /fixture — próximos partidos agrupados por fecha
      if (cmd === '/fixture' || cmd === '/fixture@botmundialistabot' || cmd === '/fixtures' || cmd === '/calendario') {
        try {
          const text = await mundialista365.getFixture();
          const doc = await cosmos.getById('fixtures', `${mundialista365.MUNDIAL_ID}-fixtures`, mundialista365.MUNDIAL_ID);
          const games = (doc?.games || []).filter((g) => new Date(g.startTime || g.date || 0) > new Date()).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)).slice(0, 10);
          if (games.length) {
            await sendMessage(chatId, text, { reply_markup: { inline_keyboard: buildGameKeyboard(games, ['odds']) } });
          } else {
            await sendMessage(chatId, text);
          }
        } catch (e) {
          await sendMessage(chatId, `⚠️ Error al obtener fixtures: ${e.message}`);
        }
        return true;
      }

      // /outrights — cuotas de campeón, goleador, etc.
      if (cmd === '/outrights' || cmd === '/outrights@botmundialistabot' || cmd === '/cuotas') {
        const text = await mundialista365.getOutrights();
        await sendMessage(chatId, text);
        return true;
      }

      // ===========================================================
      // FASE 2: Tips y Tendencias (365scores via Cosmos)
      // ===========================================================

      // /live — partidos en vivo ahora
      if (cmd === '/live' || cmd === '/live@botmundialistabot' || cmd === '/envivo' || cmd === '/envivo@botmundialistabot') {
        const text = await mundialista365.getLiveGames();
        const games = await matchSearch.findLiveGames();
        if (games && games.length > 0) {
          await sendMessage(chatId, text, { reply_markup: { inline_keyboard: buildGameKeyboard(games, ['stats', 'odds']) } });
        } else {
          await sendMessage(chatId, text);
        }
        return true;
      }

      // /tip — puede ser con args (eq1 vs eq2) o sin args (prompt de uso)
      if (cmd === '/tip' || cmd === '/tip@botmundialistabot') {
        await sendMessage(chatId,
          `🎯 *TIP DE PARTIDO*\n\n` +
          `Uso: \`/tip [equipo1] vs [equipo2]\`\n\n` +
          `Ejemplos:\n` +
          `• /tip brasil vs argentina\n` +
          `• /tip francia vs alemania\n\n` +
          `💡 El tip se calcula con base en las tendencias de los partidos (365scores). ` +
          `Para más detalles: \`/tendencias brasil vs argentina\` o \`/stats-vivo <gameId>\` (si lo conocés).`
        );
        return true;
      }
      if (cmd.startsWith('/tip ')) {
        const args = text.replace(/^\/tip(?:@\w+)?\s+/i, '').trim();
        const m = args.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        if (!m) {
          await sendMessage(chatId,
            `⚠️ Formato: \`/tip [equipo1] vs [equipo2]\`\n\n` +
            `Ejemplo: \`/tip brasil vs argentina\``
          );
          return true;
        }
        const home = m[1].trim();
        const away = m[2].trim();
        const t = await mundialista365.getTipPartido(home, away);
        await sendMessage(chatId, t);
        const game = await matchSearch.findGameByTeams(home, away).catch(() => null);
        if (game?.id) {
          await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['trends', 'odds']) } });
        }
        return true;
      }

      // /tendencias — top Mundial o por equipos (eq1 vs eq2)
      if (cmd === '/tendencias' || cmd === '/tendencias@botmundialistabot' || cmd === '/trends' || cmd === '/trends@botmundialistabot') {
        const t = await mundialista365.getTendencias('competition', null, 10);
        const o = await mundialista365.getOutrights();
        await sendMessage(chatId, t + '\n\n━━━━━━━━━━━━━━━━\n' + o);
        return true;
      }
      if (cmd.startsWith('/tendencias ') || cmd.startsWith('/trends ')) {
        const arg = text.replace(/^\/(tendencias|trends)(?:@\w+)?\s+/i, '').trim();
        if (!arg) {
          const t = await mundialista365.getTendencias('competition', null, 10);
          await sendMessage(chatId, t);
          return true;
        }
        // Modo: "eq1 vs eq2" → resuelve partido y devuelve sus trends
        const m = arg.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
        if (m) {
          const t = await mundialista365.getTendenciasByTeams(m[1].trim(), m[2].trim(), 10);
          await sendMessage(chatId, t);
          const game = await matchSearch.findGameByTeams(m[1].trim(), m[2].trim()).catch(() => null);
          if (game?.id) {
            await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(game.id, ['tip', 'odds']) } });
          }
          return true;
        }
        // Fallback: usage
        await sendMessage(chatId,
          `📊 *TENDENCIAS*\n\n` +
          `Uso:\n` +
          `  \`/tendencias\` — Top Mundial\n` +
          `  \`/tendencias brasil vs argentina\` — Trends del partido\n\n` +
          `💡 Para stats en vivo de un partido, usá los nombres con /tip, /stats-vivo o /alineacion.`
        );
        return true;
      }

      // /predicciones <gameId>
      if (cmd === '/predicciones' || cmd === '/predicciones@botmundialistabot' || cmd === '/prediccion' || cmd === '/prediccion@botmundialistabot') {
        await sendMessage(chatId,
          `🗳️ *PREDICCIONES DE LA COMUNIDAD*\n\n` +
          `Uso: \`/predicciones <gameId>\`\n\n` +
          `Ejemplo: \`/predicciones 4749268\`\n\n` +
          `💡 Para buscar el gameId, usá \`/tip brasil vs argentina\` o \`/live\`.`
        );
        return true;
      }
      if (cmd.startsWith('/predicciones ') || cmd.startsWith('/prediccion ')) {
        const arg = text.replace(/^\/(predicciones|prediccion)(?:@\w+)?\s+/i, '').trim();
        const t = await mundialista365.getPredicciones(arg);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(arg, ['odds']) } });
        return true;
      }

      // ===========================================================
      // FASE 4: Stats en vivo y alineaciones (365scores via Cosmos)
      // ===========================================================

      // /stats-vivo <gameId> — último snapshot de game_snapshots
      if (cmd === '/stats-vivo' || cmd === '/stats-vivo@botmundialistabot' ||
          cmd === '/statsvivo' || cmd === '/statsvivo@botmundialistabot' ||
          cmd === '/live-stats' || cmd === '/live-stats@botmundialistabot') {
        await sendMessage(chatId,
          `📊 *STATS EN VIVO*\n\n` +
          `Uso: \`/stats-vivo <gameId>\`\n\n` +
          `Ejemplo: \`/stats-vivo 4749268\`\n\n` +
          `💡 Para encontrar el gameId:\n` +
          `• \`/live\` para partidos en vivo\n` +
          `• \`/tip brasil vs argentina\` para un partido próximo`
        );
        return true;
      }
      if (cmd.startsWith('/stats-vivo ') || cmd.startsWith('/statsvivo ') || cmd.startsWith('/live-stats ')) {
        const arg = text.replace(/^\/(stats-vivo|statsvivo|live-stats)(?:@\w+)?\s+/i, '').trim();
        const t = await mundialista365.getStatsVivo(arg);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(arg, ['odds']) } });
        return true;
      }

      // /odds <gameId> — cuotas detalladas de un partido
      if (cmd === '/odds' || cmd === '/odds@botmundialistabot') {
        await sendMessage(chatId,
          `🎲 *CUOTAS DE PARTIDO*\n\n` +
          `Uso: \`/odds <gameId>\`\n\n` +
          `Ejemplo: \`/odds 4749268\`\n\n` +
          `💡 Para encontrar el gameId, usá \`/partidos\`, \`/fixture\` o \`/live\`.`
        );
        return true;
      }
      if (cmd.startsWith('/odds ')) {
        const arg = text.replace(/^\/odds(?:@\w+)?\s+/i, '').trim();
        const t = await mundialista365.getOdds(arg);
        await sendMessage(chatId, t);
        return true;
      }

      // /alineacion [gameId | eq1 vs eq2] — titulares y formación + fotos de jugadores
      const alineacionRe = /^\/(alineaci[oó]n|lineup|titulares)(?:@\w+)?/i;
      if (alineacionRe.test(cmd) && !text.includes(' ')) {
        await sendMessage(chatId,
          `👥 *ALINEACIONES*\n\n` +
          `Uso: \`/alineacion <gameId>\` o \`/alineacion <eq1> vs <eq2>\`\n\n` +
          `Ejemplos:\n` +
          `• /alineacion 4749268\n` +
          `• /alineacion brasil vs argentina\n\n` +
          `💡 Las alineaciones se publican cerca del kickoff.`
        );
        return true;
      }
      if (alineacionRe.test(cmd) && text.includes(' ')) {
        const arg = text.replace(alineacionRe, '').trim();
        let gameId = arg;
        const isGameId = /^\d+$/.test(arg);

        if (!isGameId) {
          try {
            const vsMatch = arg.match(/^(.+?)\s+(?:vs\.?|y|contra|c\/)\s+(.+)$/i);
            if (vsMatch) {
              const homeTeam = await cache.getTeamByName(vsMatch[1].trim());
              const awayTeam = await cache.getTeamByName(vsMatch[2].trim());
              if (homeTeam && awayTeam) {
                const match = await cache.findGameByCompetitors(homeTeam.id, awayTeam.id);
                if (match) gameId = match.id;
              }
            }
          } catch (e) {
            console.error('[alineacion] resolve error:', e.message);
          }
          if (!gameId || gameId === arg) {
            await sendMessage(chatId, `⚠️ No encontré el partido. Usá \`/alineacion <gameId>\` o \`/alineacion <eq1> vs <eq2>\`.`);
            return true;
          }
        }
        const t = await mundialista365.getAlineacion(gameId);
        const overview = await cache.getMatchOverview(gameId).catch(() => null);
        const gameData = overview?.game || null;

        const homeComp = gameData?.homeCompetitor || null;
        const awayComp = gameData?.awayCompetitor || null;
        const homeBadge = homeComp?.id ? getTeamBadgeUrl(homeComp.id, homeComp.imageVersion) : null;
        const awayBadge = awayComp?.id ? getTeamBadgeUrl(awayComp.id, awayComp.imageVersion) : null;
        const badges = [];
        if (homeBadge) badges.push({ type: 'photo', media: homeBadge });
        if (awayBadge) badges.push({ type: 'photo', media: awayBadge });
        if (badges.length > 0) await sendMediaGroup(chatId, badges);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['previa', 'odds']) } });

        // Build member name/photo lookup from full squad
        const squadMembers = overview?.members || gameData?.members || [];
        const memberMap = {};
        squadMembers.forEach(m => { if (m.id != null) memberMap[m.id] = m; });

        try {
          const sides = [
            { comp: homeComp, label: 'home' },
            { comp: awayComp, label: 'away' }
          ];
          for (const { comp } of sides) {
            if (!comp?.lineups?.members?.length) continue;
            const byPos = {};
            for (const m of comp.lineups.members) {
              const pos = m.position?.name || 'Otros';
              if (!byPos[pos]) byPos[pos] = [];
              byPos[pos].push(m);
            }
            for (const [pos, members] of Object.entries(byPos)) {
              if (!members.length) continue;
              const media = members.map(m => {
                const info = memberMap[m.id];
                return {
                  type: 'photo',
                  media: getAthleteThumbUrl(info?.athleteId || m.athleteId, info?.imageVersion || m.imageVersion),
                  caption: info?.shortName || info?.name || m.shortName || m.name || '?'
                };
              });
              for (let i = 0; i < media.length; i += 10) {
                await sendMediaGroup(chatId, media.slice(i, i + 10));
              }
            }
          }
        } catch (e) {
          console.error('[alineacion] error sending photos:', e.message);
        }
        return true;
      }

      // /previa <gameId> — pre-match stats
      if (cmd === '/previa' || cmd === '/previa@botmundialistabot' || cmd === '/preview' || cmd === '/preview@botmundialistabot') {
        await sendMessage(chatId,
          `🔮 *PREVIA DE PARTIDO*\n\n` +
          `Uso: \`/previa <gameId>\`\n\n` +
          `Ejemplo: \`/previa 4749268\`\n\n` +
          `💡 Las previas se generan para partidos programados (statusGroup=2).`
        );
        return true;
      }
      if (cmd.startsWith('/previa ') || cmd.startsWith('/preview ')) {
        const arg = text.replace(/^\/(previa|preview)(?:@\w+)?\s+/i, '').trim();
        const t = await mundialista365.getPrevia(arg);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(arg, ['lineup', 'h2h', 'odds']) } });
        return true;
      }

      // ===========================================================
      // TIER 1: Contenido del Mundial (365scores via Cosmos)
      // ===========================================================

      // /noticias [equipo]
      if (cmd === '/noticias' || cmd === '/noticias@botmundialistabot') {
        const t = await mundialistaStats.getNoticias({ equipo: null, limit: 10 });
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd.startsWith('/noticias ') || cmd.startsWith('/noticias@botmundialistabot ')) {
        const arg = text.replace(/^\/noticias(?:@\w+)?\s+/i, '').trim();
        const t = await mundialistaStats.getNoticias({ equipo: arg, limit: 10 });
        await sendMessage(chatId, t);
        return true;
      }

      // /equipoideal /idealtm /tow
      if (cmd === '/equipoideal' || cmd === '/equipoideal@botmundialistabot' ||
          cmd === '/idealtm' || cmd === '/idealtm@botmundialistabot' ||
          cmd === '/tow' || cmd === '/tow@botmundialistabot') {
        const t = await mundialistaStats.getEquipoIdeal();
        await sendMessage(chatId, t);
        return true;
      }

      // /bracket [grupos|eliminatorias|todo]  /llaves
      if (cmd === '/bracket' || cmd === '/bracket@botmundialistabot' ||
          cmd === '/llaves' || cmd === '/llaves@botmundialistabot') {
        const t = await mundialistaStats.getBracket('eliminatorias');
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd === '/bracket grupos' || cmd === '/bracket@botmundialistabot grupos' ||
          cmd === '/llaves grupos' || cmd === '/llaves@botmundialistabot grupos') {
        const t = await mundialistaStats.getBracket('grupos');
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd === '/bracket todo' || cmd === '/bracket@botmundialistabot todo' ||
          cmd === '/bracket completo' || cmd === '/bracket@botmundialistabot completo') {
        const t = await mundialistaStats.getBracket('todo');
        await sendMessage(chatId, t);
        return true;
      }

      // /historial [año|equipo]
      if (cmd === '/historial' || cmd === '/historial@botmundialistabot') {
        const t = await mundialistaStats.getHistorial(null);
        await sendMessage(chatId, t);
        return true;
      }
      if (cmd.startsWith('/historial ') || cmd.startsWith('/historial@botmundialistabot ')) {
        const arg = text.replace(/^\/historial(?:@\w+)?\s+/i, '').trim();
        const t = await mundialistaStats.getHistorial(arg);
        await sendMessage(chatId, t);
        return true;
      }

      // /goleadores /rankinggoleador /topgoleador
      if (cmd === '/goleadores' || cmd === '/goleadores@botmundialistabot' ||
          cmd === '/rankinggoleador' || cmd === '/rankinggoleador@botmundialistabot' ||
          cmd === '/topgoleador' || cmd === '/topgoleador@botmundialistabot') {
        const t = await mundialistaStats.getGoleadores(10);
        if (t.photoUrl) {
          await sendPhoto(chatId, t.photoUrl, t.text);
        } else {
          await sendMessage(chatId, t.text);
        }
        const o = await mundialista365.getOutrights().catch(() => null);
        if (o) await sendMessage(chatId, o);
        return true;
      }

      // /jugador <nombre> — foto + info del jugador
      if (cmd.startsWith('/jugador') || cmd.startsWith('/jugador@botmundialistabot ')) {
        const name = text.replace(/^\/(jugador|buscar)(?:@\w+)?\s+/i, '').trim();
        if (!name) {
          await sendMessage(chatId, '📖 Uso: `/jugador <nombre>` — ej: `/jugador mbappe`');
          return true;
        }
        const matches = await cache.searchAthletes(name);
        if (!matches || !matches.length) {
          await sendMessage(chatId, `⚠️ No encontré al jugador "${name}".`);
          return true;
        }
        const athlete = matches[0];
        const position = athlete.formationPosition?.name || athlete.position?.name || '';
        const age = athlete.age ? `, ${athlete.age} años` : '';
        let msg = `⚽ *${athlete.name}*\n📌 ${position}${age}\n🆔 ID: ${athlete.id}`;

        // Next game
        try {
          const nextDoc = await cosmos.queryOne('athlete_next_games',
            { query: 'SELECT TOP 1 * FROM c WHERE c.athleteId = @aid ORDER BY c._ts DESC', parameters: [{ name: '@aid', value: Number(athlete.id) }] });
          if (nextDoc?.game) {
            const g = nextDoc.game;
            const h = g.homeCompetitor?.name || g.homeTeam || '?';
            const a = g.awayCompetitor?.name || g.awayTeam || '?';
            const d = g.startTime ? new Date(g.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
            msg += `\n📅 *Próximo:* ${h} vs ${a} ${d ? '(' + d + ')' : ''}`;
          }
        } catch (_) {}

        // Chart events (form)
        try {
          const chart = await cosmos.getById('athlete_chart_events', String(athlete.id), Number(athlete.id));
          if (chart?.events?.length) {
            const recent = chart.events.slice(-5);
            const icons = recent.map((e) => {
              if (e.type === 'goal' || e.type === 'assist') return '⚽';
              if (e.type === 'yellow') return '🟨';
              if (e.type === 'red') return '🟥';
              if (e.type === 'subin') return '⬆';
              if (e.type === 'subout') return '⬇';
              return '·';
            }).join(' ');
            msg += `\n📈 *Últimos eventos:* ${icons}`;
          }
        } catch (_) {}

        const photoUrl = getAthletePhotoUrl(athlete.id);
        if (photoUrl) {
          await sendPhoto(chatId, photoUrl, msg);
        } else {
          await sendMessage(chatId, msg);
        }
        return true;
      }

      // /h2h <gameId> — historial entre equipos
      if (cmd === '/h2h' || cmd === '/h2h@botmundialistabot' || cmd === '/historial-partido' || cmd === '/historial-partido@botmundialistabot') {
        await sendMessage(chatId,
          `🤝 *HISTORIAL ENTRE EQUIPOS (H2H)*\n\n` +
          `Uso: \`/h2h <gameId>\`\n\n` +
          `Ejemplo: \`/h2h 4749268\``
        );
        return true;
      }
      if (cmd.startsWith('/h2h ') || cmd.startsWith('/historial-partido ')) {
        const arg = text.replace(/^\/(h2h|historial-partido)(?:@\w+)?\s+/i, '').trim();
        const t = await mundialista365.getH2H(arg);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(arg, ['previa', 'odds']) } });
        return true;
      }

      return false;
  }
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

const ACTION_LABELS = {
  tip: '🎯 Tip',
  trends: '📊 Trends',
  odds: '🎲 Odds',
  h2h: '🤝 H2H',
  previa: '📊 Previa',
  lineup: '📋 Alineación',
  stats: '📈 Stats Vivo',
};

/**
 * Construye teclado inline para una lista de partidos.
 * @param {Array} games
 * @param {string[]} actions - acciones por partido (tip, trends, odds, h2h, previa, lineup, stats)
 */
function buildGameKeyboard(games, actions = ['tip', 'trends', 'odds']) {
  const keyboard = [];
  for (const m of games) {
    const gameId = m.id;
    const home = (m.homeCompetitor?.name || m.homeTeam || '???').substring(0, 3).toUpperCase();
    const away = (m.awayCompetitor?.name || m.awayTeam || '???').substring(0, 3).toUpperCase();
    const row = actions.map((a) => ({
      text: `${ACTION_LABELS[a] || a} ${home}-${away}`,
      callback_data: `${a}_${gameId}`,
    }));
    keyboard.push(row);
  }
  return keyboard;
}

/**
 * Construye teclado inline para un solo partido (una fila).
 * @param {string|number} gameId
 * @param {string[]} actions
 */
function buildSingleGameKeyboard(gameId, actions = ['odds']) {
  const row = actions.map((a) => ({
    text: ACTION_LABELS[a] || a,
    callback_data: `${a}_${gameId}`,
  }));
  return [row];
}

/**
 * Maneja callback queries del teclado inline de partidos
 */
async function handlePartidosCallback(chatId, callbackData) {
  const idx = callbackData.indexOf('_');
  if (idx === -1) {
    await sendMessage(chatId, '⚠️ Acción no válida.');
    return;
  }
  const action = callbackData.substring(0, idx);
  const gameId = callbackData.substring(idx + 1);

  const handlers = {
    tip: async () => {
      try {
        const game = await cache.getGameById(gameId);
        if (game?.homeCompetitor?.name && game?.awayCompetitor?.name) {
          const tip = await mundialista365.formatTipForGame(game);
          if (tip) {
            await sendMessage(chatId, tip);
            if (gameId) {
              await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['trends', 'odds']) } });
            }
          } else {
            await sendMessage(chatId, '⚠️ No hay tip disponible para ese partido.');
          }
        } else {
          await sendMessage(chatId, '⚠️ No pude obtener información de ese partido.');
        }
      } catch (e) {
        console.error('[callback tip] error:', e.message);
        await sendMessage(chatId, '⚠️ Error al obtener tip de ese partido.');
      }
    },
    trends: async () => {
      try {
        const t = await mundialista365.getTendencias('game', gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['tip', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener tendencias.');
      }
    },
    odds: async () => {
      try {
        const t = await mundialista365.getOdds(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['tip', 'trends']) } });
      } catch (e) {
        console.error('[callback odds] error:', e);
        await sendMessage(chatId, '⚠️ Error al obtener cuotas.');
      }
    },
    h2h: async () => {
      try {
        const t = await mundialista365.getH2H(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['previa', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener historial.');
      }
    },
    previa: async () => {
      try {
        const t = await mundialista365.getPrevia(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['lineup', 'h2h', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener previa.');
      }
    },
    lineup: async () => {
      try {
        const t = await mundialista365.getAlineacion(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['previa', 'odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener alineación.');
      }
    },
    stats: async () => {
      try {
        const t = await mundialista365.getStatsVivo(gameId);
        await sendMessage(chatId, t);
        await sendMessage(chatId, '💡 Más opciones:', { reply_markup: { inline_keyboard: buildSingleGameKeyboard(gameId, ['odds']) } });
      } catch (e) {
        await sendMessage(chatId, '⚠️ Error al obtener stats.');
      }
    },
  };

  const handler = handlers[action];
  if (handler) {
    await handler();
  } else {
    await sendMessage(chatId, '⚠️ Acción no reconocida.');
  }
}

/**
 * Maneja un update individual del webhook de Telegram
 */
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

  // Configurar webhook con Telegram
  try {
    const res = await telegramRequest('setWebhook', { url: WEBHOOK_URL });
    if (res.ok) {
      console.log(`✅ Webhook configurado: ${WEBHOOK_URL}`);
    } else {
      console.error('❌ Error configurando webhook:', res.description);
    }
  } catch (error) {
    console.error('❌ Error configurando webhook:', error.message);
  }

  console.log(`✅ BotMundialista Telegram listo!`);
  console.log(`📱 Token: ${TELEGRAM_TOKEN?.substring(0, 10)}...`);
  console.log(`🌐 Webhook: ${WEBHOOK_URL}`);
}

// Iniciar
init();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Apagando bot de Telegram...');
  process.exit(0);
});
