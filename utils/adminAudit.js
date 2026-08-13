/**
 * utils/adminAudit.js — Auditoría 2026-Q3 Fase 9.1
 *
 * Logger Pino separado para registrar acciones del panel admin.
 * Redacción de tokens (header Authorization, cookie) para no leakear
 * credenciales en los logs.
 *
 * Uso:
 *   const audit = require('./utils/adminAudit');
 *   audit.info({ method, url, status, durationMs, ip }, 'admin request');
 *
 * Configuración vía env:
 *   ADMIN_AUDIT_FILE=/var/log/scorehub-admin.log → loguea a archivo
 *   (sin esto, va a stdout via pino-pretty en dev o JSON en prod).
 */

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: 'info',
  base: { component: 'admin-audit', app: 'scorehub' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'token',
      'tokenPrefix',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env.ADMIN_AUDIT_FILE
    ? pino.transport({
        target: 'pino/file',
        options: { destination: process.env.ADMIN_AUDIT_FILE },
      })
    : isDev
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});

module.exports = logger;