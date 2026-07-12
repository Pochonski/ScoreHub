require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pinoHttp = require('pino-http');
const footballRoutes = require('./routes/football');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3002;
const isDev = process.env.NODE_ENV !== 'production';

const whitelist = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'https://dashboard.mundialista.com'];

const pino = require('pino');
const serverLogger = pino({
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  level: process.env.LOG_LEVEL || 'info',
});
app.use(pinoHttp({
  logger: serverLogger,
  quietReqLogger: true,
}));
app.use(helmet());
app.use(cors({ origin: whitelist, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

async function cosmosHealth() {
  const cosmos = require(path.join(__dirname, '..', '..', 'database', 'cosmos'));
  const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
  await cosmos.getById('catalog', String(MUNDIAL_ID), String(MUNDIAL_ID));
}

app.get('/api/football/health', async (req, res) => {
  const start = Date.now();
  try {
    await cosmosHealth();
    res.json({
      status: 'ok',
      cosmos: 'connected',
      uptime: process.uptime(),
      latency: `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    serverLogger.error({ err: e }, 'Health check falló');
    res.status(503).json({
      status: 'degraded',
      cosmos: 'disconnected',
      uptime: process.uptime(),
      error: e.message,
    });
  }
});

app.use('/api/football', footballRoutes);
app.use(errorHandler);

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    serverLogger.info({ port: PORT, env: isDev ? 'development' : 'production' }, `Mundialista Dashboard API corriendo en puerto ${PORT}`);
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
