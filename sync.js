// Entry point del servicio de sync (cron ETL). La lógica vive en la capa
// interface (Fase 7): src/interface/scheduler/scheduler.js.
require('dotenv').config();
const log = require('./utils/logger');
const { start } = require('./src/interface/scheduler/scheduler');

start().catch((err) => {
  log.error({ err }, 'Fatal error en sync');
  process.exit(1);
});
