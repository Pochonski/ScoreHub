// Entry point del servicio de sync (cron ETL). La lógica vive en la capa
// interface (Fase 7): src/interface/scheduler/scheduler.js.
require('dotenv').config();
const log = require('./utils/logger');
const conversationContext = require('./services/conversationContext');
const { start } = require('./src/interface/scheduler/scheduler');

start().catch((err) => {
  log.error({ err }, 'Fatal error en sync');
  process.exit(1);
});

// Auditoría 2026-Q3 Fase 5.1: flush contexto en SIGTERM/SIGINT.
// El sync process comparte conversationContext con el bot (legacy design),
// por lo que debe respetar la misma política de flush.
const shutdown = (signal) => {
  log.info(`Sync shutdown (${signal})`);
  try {
    conversationContext.flushSync();
  } catch (e) {
    log.error({ err: e }, 'conversationContext.flushSync failed');
  }
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
