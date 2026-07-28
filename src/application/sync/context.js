/**
 * src/application/sync/context.js — Contexto compartido de los jobs de sync
 * (Fase 7, Fase 4).
 *
 * Reúne las dependencias comunes (api 365scores, DB, competiciones activas,
 * logger + helpers de log con `syncRunId`, y los writers de infrastructure) que
 * usan los módulos de sync por dominio (games, standings, catalog, …).
 */

require('dotenv').config();
const api = require('../../../services/scores365Service');
const { pool, withTransaction } = require('../../../database/connection');
const db = require('../../../database/db');
const { getActiveCompetitions, forEachActive } = require('../../../services/syncCompetitions');
const logger = require('../../../utils/logger');
const writers = require('../../infrastructure/persistence/syncWriters');

// `syncRunId` correlaciona los logs de una corrida completa (lo setea syncAll).
let currentSyncRunId = null;

function newSyncRunId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${t}-${r}`;
}

function setSyncRunId(id) { currentSyncRunId = id; }

function log(...args) {
  logger.info({ syncRunId: currentSyncRunId, mod: 'sync' }, '[Sync] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
}

function logErr(...args) {
  logger.error({ syncRunId: currentSyncRunId, mod: 'sync' }, '[Sync] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
}

module.exports = {
  api,
  pool,
  withTransaction,
  db,
  getActiveCompetitions,
  forEachActive,
  logger,
  newSyncRunId,
  setSyncRunId,
  log,
  logErr,
  ...writers,
};
