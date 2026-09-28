/**
 * src/interface/monitor/monitor.js — Orquestador del monitor (Fase monitoreo-2026).
 *
 * Uso:
 *   node src/interface/monitor/monitor.js --once   # una corrida (cron/CI)
 *   node src/interface/monitor/monitor.js          # daemon (cron interno 5min)
 *
 * Cada corrida:
 *   1. ping DB (si cae → alerta crítica y se salta el resto).
 *   2. heartbeats de sync → issues (missing/error/stale).
 *   3. egress Supabase (best-effort; alerta si supera 80%).
 *   4. Por cada issue: alerta con cooldown; si un issue previo se recuperó,
 *      avisa recuperación.
 * Exit code: 0 ok, 1 con issues críticos, 2 error interno.
 */

require('dotenv').config();
const cron = require('node-cron');
const { install: installProcessGuard } = require('../../../utils/processGuard');
const log = require('../../../utils/logger');
const checks = require('./checks');
const alert = require('./alert');

const EGRESS_WARN_PCT = parseFloat(process.env.EGRESS_WARN_PCT || '0.8');

function formatIssue(i) {
  const icon = i.severity === 'critical' ? '🔴' : '🟡';
  return `${icon} ${i.job || i.key}: ${i.detail}`;
}

async function runOnce({ now = Date.now(), checkDeps = {}, alertDeps = {} } = {}) {
  const issues = [];
  const sent = [];

  // 1. DB
  const db = await checks.pingDb();
  if (!db.ok) {
    issues.push({ key: 'db', job: 'postgres', severity: 'critical', detail: `DB caída: ${db.error}` });
    return { ok: false, issues, sent, db };
  }

  // 2. Sync freshness
  const rows = await checks.readHeartbeats();
  for (const i of checks.evaluateFreshness(rows, undefined, now)) issues.push(i);

  // 3. Egress (best-effort)
  let egress = { skipped: true };
  try {
    egress = await checks.checkEgress(checkDeps);
    if (!egress.skipped && egress.pct >= EGRESS_WARN_PCT) {
      issues.push({
        key: 'egress', job: 'supabase-egress', severity: 'critical',
        detail: `egress ${egress.usedGb.toFixed(2)}/${egress.limitGb.toFixed(2)}GB (${Math.round(egress.pct * 100)}%)`,
      });
    }
  } catch (e) {
    log.warn({ err: e.message }, 'monitor: egress check falló (ignorado)');
  }

  // 4. Alertas con cooldown
  for (const i of issues) {
    const fire = alertDeps.shouldAlert
      ? await alertDeps.shouldAlert(i.key, now)
      : await alert.shouldAlert(i.key, now);
    if (fire) {
      const send = alertDeps.sendTelegram || alert.sendTelegram;
      const r = await send(`🚨 ScoreHub\n${formatIssue(i)}`);
      if (r.sent) {
        await alert.markAlerted(i.key, true);
        sent.push(i.key);
      }
    }
  }

  // 5. Recuperaciones: claves alertadas que ya no fallan
  const recovered = [];
  try {
    const failing = new Set(issues.map((i) => i.key));
    const previously = alertDeps.listAlerted
      ? await alertDeps.listAlerted()
      : await alert.listAlerted();
    for (const key of previously) {
      if (!failing.has(key)) {
        const send = alertDeps.sendTelegram || alert.sendTelegram;
        const r = await send(`✅ ScoreHub recuperado: ${key}`);
        await alert.markAlerted(key, false);
        if (r.sent) recovered.push(key);
      }
    }
  } catch (e) {
    log.warn({ err: e.message }, 'monitor: chequeo de recuperaciones falló (ignorado)');
  }

  return { ok: !issues.some((i) => i.severity === 'critical'), issues, sent, recovered, db, egress };
}

async function start() {
  installProcessGuard({ name: 'monitor', logger: log });
  const expr = process.env.MONITOR_CRON || '*/5 * * * *';
  log.info(`Monitor corriendo (cron ${expr})...`);
  await runOnce().catch((e) => log.error({ err: e.message }, 'monitor: corrida inicial falló'));
  cron.schedule(expr, () => {
    runOnce().catch((e) => log.error({ err: e.message }, 'monitor: corrida falló'));
  });
}

module.exports = { runOnce, start, formatIssue };

if (require.main === module) {
  if (process.argv.includes('--once')) {
    runOnce()
      .then((r) => {
        log.info({ issues: r.issues.length, sent: r.sent.length }, 'monitor: corrida única lista');
        process.exit(r.ok ? 0 : 1);
      })
      .catch((e) => {
        log.error({ err: e?.message }, 'monitor: error fatal');
        process.exit(2);
      });
  } else {
    start().catch((e) => {
      log.error({ err: e?.message }, 'monitor: fatal en start');
      process.exit(2);
    });
  }
}
