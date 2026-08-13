/**
 * src/interface/http/server.js — Health / webhook / admin HTTP server (Fase 7, Fase 1).
 *
 * Extraído de telegramBot.js. Es la capa de delivery HTTP del proceso del bot:
 *   - GET /health (y /)   → estado del proceso (rate-limited)
 *   - POST /webhook       → delega el update de Telegram a `handleWebhookUpdate`
 *   - /admin/*            → panel admin (auth por ADMIN_TOKEN) + API de métricas
 *
 * `createHttpServer(deps)` es una factory: recibe el estado/colaboradores que
 * viven en el composition root (`getDbAvailable`, `handleWebhookUpdate`) e
 * inyecta el resto (pool, adminAuth) por require directo. Devuelve el `server`
 * y el `handleRequest` (testeable con req/res mock).
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const config = require('../../infrastructure/config');
const log = require('../../../utils/logger');
const { isAdminEnabled, requireAdmin } = require('../../../utils/adminAuth');
const { pool } = require('../../../database/connection');

// Auditoría 2026-Q3 Fase 1.3 + Fase 4.1: security headers manuales + config
// centralizado. createHttpServer usa http nativo (no express), por eso no
// podemos usar helmet middleware; aplicamos headers equivalentes.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};
if (config.helpers.isProduction()) {
  SECURITY_HEADERS['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
}

function applySecurityHeaders(res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!res.getHeader(k)) res.setHeader(k, v);
  }
}

// Raíz del repo (admin/public/ se resuelve desde acá, antes vía __dirname del root).
const ROOT = path.join(__dirname, '..', '..', '..');
const WEBHOOK_PATH = '/webhook';

function createHttpServer({ getDbAvailable, handleWebhookUpdate }) {
  const rateLimit = new Map();

  function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimit.get(ip) || { count: 0, resetAt: now + 60000 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
    entry.count++;
    rateLimit.set(ip, entry);
    if (rateLimit.size > 1000) {
      const oldest = rateLimit.keys().next().value;
      rateLimit.delete(oldest);
    }
    return entry.count <= 30;
  }

  async function handleAdminRoute(req, res, url) {
    const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Gate de auth: si ADMIN_TOKEN no está configurado, admin deshabilitado.
    if (!isAdminEnabled()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin deshabilitado. Configure ADMIN_TOKEN.' }));
      return;
    }
    // Exigir token válido (Bearer o cookie) para TODO /admin/*.
    if (!requireAdmin(req)) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="scorehub-admin"',
      });
      res.end(JSON.stringify({ error: 'No autorizado. Provide Authorization: Bearer <ADMIN_TOKEN>.' }));
      return;
    }

    // Servir index.html para /admin y /admin/
    if (pathname === '/admin' || pathname === '/admin/') {
      const indexPath = path.join(ROOT, 'admin', 'public', 'index.html');
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
            log.error({ err: error }, '[admin] rename error');
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Error al renombrar usuario' }));
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
        log.error({ err: error, pathname }, '[admin] handler error');
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Database error' }));
      }
      return;
    }

    // Servir archivos estáticos de admin/public/
    if (pathname.startsWith('/admin/public/')) {
      const relPath = pathname.replace('/admin/public/', '');
      const filePath = path.join(ROOT, 'admin', 'public', relPath);
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
        log.error({ err: e, filePath }, '[admin] static file error');
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  }

  function handleRequest(req, res) {
    const url = req.url || '/';
    applySecurityHeaders(res);
    if (url === '/health' || url === '/') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'too many requests' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        bot: 'ScoreHub',
        uptime: process.uptime(),
        db: getDbAvailable() ? 'connected' : 'demo',
        timestamp: new Date().toISOString()
      }));
    } else if (url === WEBHOOK_PATH && req.method === 'POST') {
      // Auditoría 2026-Q3 C2 — validar X-Telegram-Bot-Api-Secret-Token.
      // Si WEBHOOK_SECRET está configurado, el header debe coincidir exactamente.
      // En producción sin secret, el endpoint queda cerrado (503) por seguridad.
      const expectedSecret = config.helpers.webhookSecret();
      if (expectedSecret) {
        const provided = req.headers['x-telegram-bot-api-secret-token'];
        if (!provided || provided !== expectedSecret) {
          res.writeHead(401, { 'Content-Type': 'text/plain' });
          res.end('unauthorized');
          return;
        }
      } else if (config.helpers.isProduction()) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('webhook disabled');
        return;
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        res.writeHead(200);
        res.end();
        try {
          const update = JSON.parse(body);
          handleWebhookUpdate(update).catch(e => log.error({ err: e }, '[webhook] handler error'));
        } catch (e) {
          log.error({ err: e }, '[webhook] body parse error');
        }
      });
    } else if (url.startsWith('/admin')) {
      handleAdminRoute(req, res, url);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  const server = http.createServer(handleRequest);
  return { server, handleRequest, checkRateLimit };
}

module.exports = { createHttpServer, WEBHOOK_PATH };
