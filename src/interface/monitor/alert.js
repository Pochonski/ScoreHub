/**
 * src/interface/monitor/alert.js — Envío de alertas a Telegram con cooldown.
 *
 * - Destino: ALERT_CHAT_ID (chat/grupo donde está el bot de ScoreHub).
 * - Cooldown por defecto 60min por clave (env ALERT_COOLDOWN_MS): mientras
 *   algo sigue fallando no spamea; al recuperarse manda "recuperado".
 * - Estado en tabla monitor_state (migración 027). Si la DB está caída no
 *   hay cooldown persistente: se envía igual (mejor ruido que silencio).
 */

const COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MS || `${60 * 60 * 1000}`, 10);

async function getState(key) {
  try {
    const db = require('../../../database/db');
    const { data } = await db.query('monitor_state', {
      select: 'value',
      eq: { key },
      maybeSingle: true,
    });
    return data?.value ?? null;
  } catch {
    return null;
  }
}

async function setState(key, value) {
  try {
    const db = require('../../../database/db');
    await db.upsert(
      'monitor_state',
      { key, value: String(value), updated_at: new Date().toISOString() },
      'key'
    );
  } catch {}
}

/**
 * ¿Se debe alertar ahora por `key`? true la primera vez y luego solo si
 * pasó el cooldown. Actualiza el timestamp cuando decide alertar.
 */
async function shouldAlert(key, now = Date.now(), cooldownMs = COOLDOWN_MS) {
  const last = await getState(`cooldown:${key}`);
  const lastMs = last ? new Date(last).getTime() : NaN;
  if (Number.isFinite(lastMs) && now - lastMs < cooldownMs) return false;
  await setState(`cooldown:${key}`, new Date(now).toISOString());
  return true;
}

async function markAlerted(key, alerted) {
  await setState(`alerted:${key}`, alerted ? '1' : '0');
}

async function wasAlerted(key) {
  return (await getState(`alerted:${key}`)) === '1';
}

/** Claves con alerta activa (para detectar recuperaciones). */
async function listAlerted() {
  try {
    const db = require('../../../database/db');
    const rows = await db.execAdvanced(
      "SELECT key FROM monitor_state WHERE key LIKE 'alerted:%' AND value = '1'"
    );
    return rows.map((r) => String(r.key).replace(/^alerted:/, ''));
  } catch {
    return [];
  }
}

/** Envía texto al chat de alertas. Retorna {sent} (false + warn si falta config). */
async function sendTelegram(text) {
  const chatId = process.env.ALERT_CHAT_ID || '';
  if (!chatId) {
    try {
      require('../../../utils/logger').warn('monitor: ALERT_CHAT_ID no seteado, alerta no enviada');
    } catch {}
    return { sent: false, reason: 'sin ALERT_CHAT_ID' };
  }
  try {
    const { sendMessage } = require('../telegram/client');
    await sendMessage(chatId, text);
    return { sent: true };
  } catch (e) {
    try {
      require('../../../utils/logger').error({ err: e.message }, 'monitor: fallo envío Telegram');
    } catch {}
    return { sent: false, reason: e.message };
  }
}

module.exports = { COOLDOWN_MS, getState, setState, shouldAlert, markAlerted, wasAlerted, listAlerted, sendTelegram };
