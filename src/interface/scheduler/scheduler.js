require('dotenv').config();
const cron = require('node-cron');
const { createSyncOrchestrator } = require('../../application/sync/orchestrator');
const { testConnection } = require('../../../database/connection');
const { install: installProcessGuard } = require('../../../utils/processGuard');
const log = require('../../../utils/logger');
const jobGuard = require('../../../utils/jobGuard');
installProcessGuard({ name: 'sync', logger: log });

async function start() {
  const connected = await testConnection();
  if (!connected) {
    log.error('No se pudo conectar a la base de datos. Saliendo.');
    process.exit(1);
  }

  // T1.2: scheduler usa el syncOrchestrator use-case con DI explícita.
  // Antes: `sync.syncAll()` directo sobre el módulo legacy. Ahora el
  // orchestrator devuelve {runId, jobs[], successful, failed} para mejor
  // observabilidad vía logs.
  // El orchestrator espera `logger` como callable (`logger?.(msg)`), no como
  // instancia pino. Le pasamos un wrapper que delega en log.info.
  const sync = createSyncOrchestrator({ logger: (msg) => log.info(msg) });

  // Run full sync immediately on startup.
  // Fase 8.1: se ejecuta en background para no bloquear el startup si un job
  // tarda (los crons tienen jobGuard anti-solapamiento).
  log.info('Iniciando sync completo inicial (background)...');
  sync.runFullSync().then((r) => {
    log.info({ runId: r.runId, ok: r.successful, failed: r.failed }, 'full sync initial done');
  }).catch((err) => {
    log.error({ err: err.message }, 'syncAll failed');
  });

  // Helper para schedulear con guard anti-solapamiento
  const every = (expr, name, fn) => cron.schedule(expr, jobGuard.wrap(name, fn));

  // =====================================================================
  // Optimización de egress (2026-09): cada `sync.runX()` se agenda UNA sola
  // vez. Antes, cada job interno se registraba en un cron separado que
  // disparaba el grupo entero, multiplicando el tráfico por 4-6x.
  // =====================================================================

  // Partidos en vivo (games + detalles/live stats) — 60s. Los datos en vivo
  // cambian rápido, pero 15s era redundante y el `jobGuard` evita solapamiento.
  every('*/60 * * * * *', 'syncGames', () => sync.runGames());

  // Live stats (overviews/h2h/lineups/stats de partidos en vivo) — 60s.
  every('*/60 * * * * *', 'syncLiveStats', () => sync.runDetails());

  // Standings (tablas de posiciones) — cada 15 min.
  every('*/15 * * * *', 'syncStandings', () => sync.runStandings());

  // Trends + predictions + odds + outrights + trend details (grupo pesado,
  // 1 call por partido/trend) — cada 60 min.
  every('0 * * * *', 'syncTrendsOdds', () => sync.runTrendsOdds());

  // Contenido (brackets, stats, team of week, news) — cada 60 min.
  every('0 * * * *', 'syncContent', () => sync.runContent());

  // Atletas + venues (cambian lento) — cada 3 horas.
  every('0 */3 * * *', 'syncAthletes', () => sync.runAthletes());

  // Bet selections — cada 5 min (evalúa selecciones de apuestas ya jugadas).
  every('*/5 * * * *', 'syncBetSelections', () => sync.runBetSelections());

  // Transfers + suggestions (fichajes, top upcoming) — cada 6 horas.
  every('0 */6 * * *', 'syncTransfers', () => sync.runTransfers());

  // Catálogo + países — cada 12 horas.
  every('0 */12 * * *', 'syncCatalog', () => sync.runCatalog());

  log.info('Todos los cron jobs scheduleados (con guards anti-solapamiento). Servicio corriendo.');
}

module.exports = { start };

// Entry directo: `node src/interface/scheduler/scheduler.js` (además del entry
// fino en sync.js para compatibilidad con el deploy existente).
if (require.main === module) {
  start().catch((err) => {
    log.error({ err }, 'Fatal error en sync');
    process.exit(1);
  });
}
