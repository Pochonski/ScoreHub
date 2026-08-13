require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pinoHttp = require('pino-http');
const footballRoutes = require('./routes/football');
const errorHandler = require('./middleware/errorHandler');
const { install: installProcessGuard } = require('../../utils/processGuard');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3002;
const isDev = process.env.NODE_ENV !== 'production';

// Auditoría 2026-Q3 S9: whitelist restrictivo en default.
// Si CORS_ORIGINS no está seteado, sólo se permite localhost (desarrollo).
// En PRODUCCIÓN, CORS_ORIGINS DEBE estar seteado en env.
const whitelist = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['http://localhost:5173'];
if (!process.env.CORS_ORIGINS && process.env.NODE_ENV === 'production') {
  serverLogger.warn(
    'CORS_ORIGINS no configurado en producción — sólo se aceptarán requests desde localhost'
  );
}

const pino = require('pino');
const serverLogger = pino({
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  level: process.env.LOG_LEVEL || 'info',
});
installProcessGuard({ name: 'dashboard-server', logger: serverLogger });
app.use(pinoHttp({
  logger: serverLogger,
  quietReqLogger: true,
}));
app.use(helmet());
app.set('trust proxy', 1);
app.use(cors({ origin: whitelist }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/football/health', async (req, res) => {
  try {
    const { pool } = require('../../database/connection');
    const { isEnabled: supabaseEnabled } = require('../../database/supabaseClient');
    const dbStats = require('../../utils/dbStats');
    const r = await pool.query('SELECT NOW() as now');
    res.json({
      status: 'ok',
      datasource: '365scores',
      cache: 'supabase',
      db: 'connected',
      dbTime: r.rows[0]?.now,
      dbStrategy: supabaseEnabled ? 'http+pg-fallback' : 'pg-only',
      uptime: process.uptime(),
      dbStats: dbStats.getStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      status: 'error',
      datasource: '365scores',
      cache: 'supabase',
      db: 'disconnected',
      error: e.message,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});



app.use('/api/football', footballRoutes);
app.use(errorHandler);

// 404 JSON para rutas /api/* no matcheadas (evita devolver el HTML del SPA
// a clientes API que esperarían JSON).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
        serverLogger.info({ port: PORT, env: isDev ? 'development' : 'production' }, `ScoreHub Dashboard API corriendo en puerto ${PORT}`);
  });

  process.on('SIGTERM', () => {
    serverLogger.info('SIGTERM recibido, cerrando servidor...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    serverLogger.info('SIGINT recibido, cerrando servidor...');
    server.close(() => process.exit(0));
  });
}

module.exports = app;
