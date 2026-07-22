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

const whitelist = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'https://scorehub-pocho.vercel.app', 'https://scorehub-rust.vercel.app'];

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
  res.json({
    status: 'ok',
    datasource: '365scores',
    cache: 'supabase',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
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
