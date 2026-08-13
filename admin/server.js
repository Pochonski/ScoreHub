require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('../database/connection');
const path = require('path');
const { isAdminEnabled, requireAdmin } = require('../utils/adminAuth');
const audit = require('../utils/adminAudit');

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;

// Middleware
app.use(express.json());

// Auditoría 2026-Q3 S5: rate limit 100 req/15min en /api/* (no en static ni en /).
// Previene brute-force del ADMIN_TOKEN y scraping de datos.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas requests. Intenta en 15 minutos.' },
});
app.use('/api/', adminLimiter);

// Auditoría 2026-Q3 S6: helmet con CSP permisivo para CDN scripts del admin.
// CSP estricto se configurará en Fase 9; por ahora deshabilitar CSP inline.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Auth gate para TODO el panel admin.
// - Si ADMIN_TOKEN no está configurado → 503 (deshabilitado, seguro por defecto).
// - Si falta token o es inválido → 401.
app.use((req, res, next) => {
  // Permitir options preflight sin auth.
  if (req.method === 'OPTIONS') return next();
  if (!isAdminEnabled()) {
    return res.status(503).json({ error: 'Admin deshabilitado. Configure ADMIN_TOKEN.' });
  }
  if (!requireAdmin(req)) {
    return res.status(401).set('WWW-Authenticate', 'Bearer realm="scorehub-admin"').json({ error: 'No autorizado.' });
  }
  next();
});

// Auditoría 2026-Q3 Fase 9.1: middleware de audit log.
// Loguea cada request autenticado a /api/* con method, url, status, duración.
// NO loguea requests a / (SPA) ni static files para no inflar el log.
app.use('/api/', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    audit.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
      tokenPrefix: String(req.headers.authorization || '').slice(0, 16),
    }, 'admin api request');
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// API: Estadísticas generales
app.get('/api/stats', async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as total FROM usuarios');
    const queries = await pool.query('SELECT COUNT(*) as total FROM historial_consultas');
    const teamsFollowed = await pool.query('SELECT COUNT(*) as total FROM equipos_seguidos');

    const todayQueries = await pool.query(
      'SELECT COUNT(*) as total FROM historial_consultas WHERE DATE(fecha) = CURRENT_DATE'
    );

    res.json({
      totalUsers: parseInt(users.rows[0].total),
      totalQueries: parseInt(queries.rows[0].total),
      teamsFollowed: parseInt(teamsFollowed.rows[0].total),
      todayQueries: parseInt(todayQueries.rows[0].total)
    });
  } catch (error) {
    console.error('Error /api/stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Usuarios recientes
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, alias, fecha_registro FROM usuarios ORDER BY fecha_registro DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/users:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Consultas recientes
app.get('/api/queries', async (req, res) => {
  try {
    // Auditoría 2026-Q3 S4: clampear limit para evitar OOM por ?limit=999999999.
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    // Auditoría 2026-Q3 S11: redacción de PII.
    // - consulta: trunca a 200 chars por default, full con ?full=1
    // - respuesta: NO se incluye por default (puede contener datos sensibles);
    //   requiere ?expand=1 para verla (queda registrado en audit log en Fase 9).
    const fullText = req.query.full === '1';
    const expandResponse = req.query.expand === '1';
    const consultaExpr = fullText ? 'h.consulta' : 'LEFT(h.consulta, 200) AS consulta';
    const respuestaExpr = expandResponse ? 'LEFT(h.respuesta, 500) AS respuesta' : 'NULL::text AS respuesta';
    const result = await pool.query(
      `SELECT h.id, ${consultaExpr}, h.tipo, ${respuestaExpr}, h.fecha, u.alias
       FROM historial_consultas h
       JOIN usuarios u ON h.id_usuario = u.id
       ORDER BY h.fecha DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/queries:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Equipos seguidos
app.get('/api/followed-teams', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.nombre_equipo, u.alias, e.fecha_seguimiento
       FROM equipos_seguidos e
       JOIN usuarios u ON e.id_usuario = u.id
       ORDER BY e.fecha_seguimiento DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/followed-teams:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Consultas por tipo
app.get('/api/queries-by-type', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tipo, COUNT(*) as total
       FROM historial_consultas
       GROUP BY tipo
       ORDER BY total DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/queries-by-type:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Solo iniciar servidor independiente si ADMIN_STANDALONE=true (para desarrollo local)
// En producción las rutas /admin/* se sirven desde el servidor principal del bot
if (process.env.ADMIN_STANDALONE === 'true') {
  app.listen(PORT, () => {
    console.log(`🚀 Panel Admin corriendo en http://localhost:${PORT}`);
  });
} else {
  console.log('📋 Panel Admin integrado en servidor principal (rutas /admin/*)');
}

// Auditoría 2026-Q3 Fase 8.7: exponer la app para tests con supertest.
// En producción (cuando ADMIN_STANDALONE=true y se llama app.listen), esto
// no afecta — sólo sirve como handle para tests de integración.
module.exports = app;