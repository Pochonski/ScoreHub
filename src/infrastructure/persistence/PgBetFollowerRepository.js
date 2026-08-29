/**
 * src/infrastructure/persistence/PgBetFollowerRepository.js — Adapter para IBetFollowerRepository.
 *
 * Tabla `bet_followers_v2` con PK compuesta (apuesta_id, chat_id, mode). Las
 * queries usan `db.execAdvanced` (pg pool) porque el filtro por columna
 * indexada + ORDER BY requiere SQL explícito y Supabase HTTP no soporta
 * UPSERT sobre PK compuesta directamente.
 */

const db = require('../../../database/db');

class PgBetFollowerRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async getTicketSummary(apuestaId) {
    if (!Number.isFinite(apuestaId)) return null;
    const rows = await db.execAdvanced(
      `SELECT id, id_usuario, id_partido_api, estado, partido_extrado
       FROM apuestas WHERE id = $1`,
      [apuestaId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      idUsuario: row.id_usuario,
      idPartidoApi: row.id_partido_api,
      estado: row.estado,
      partidoExtrado: row.partido_extrado,
    };
  }

  async getForUser(apuestaId, chatId) {
    if (!Number.isFinite(apuestaId)) return null;
    const rows = await db.execAdvanced(
      `SELECT apuesta_id, chat_id, mode, last_notified_status, created_at, updated_at
       FROM bet_followers_v2
       WHERE apuesta_id = $1 AND chat_id = $2
       ORDER BY mode
       LIMIT 1`,
      [apuestaId, chatId]
    );
    const row = rows[0];
    if (!row) return null;
    return this._toDto(row);
  }

  async upsertForUser(apuestaId, chatId, mode, lastNotified = null) {
    if (!Number.isFinite(apuestaId)) return;
    await db.execAdvanced(
      `INSERT INTO bet_followers_v2
         (apuesta_id, chat_id, mode, last_notified_status, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now())
       ON CONFLICT (apuesta_id, chat_id, mode) DO UPDATE
         SET last_notified_status = COALESCE(EXCLUDED.last_notified_status, bet_followers_v2.last_notified_status),
             updated_at = now()`,
      [
        apuestaId,
        chatId,
        mode,
        lastNotified ? JSON.stringify(lastNotified) : null,
      ]
    );
  }

  async removeForUser(apuestaId, chatId, mode) {
    if (!Number.isFinite(apuestaId)) return;
    await db.execAdvanced(
      `DELETE FROM bet_followers_v2
        WHERE apuesta_id = $1 AND chat_id = $2 AND mode = $3`,
      [apuestaId, chatId, mode]
    );
  }

  async removeAllForUser(apuestaId, chatId) {
    if (!Number.isFinite(apuestaId)) return;
    await db.execAdvanced(
      `DELETE FROM bet_followers_v2 WHERE apuesta_id = $1 AND chat_id = $2`,
      [apuestaId, chatId]
    );
  }

  async countByChat(chatId, mode) {
    const params = [chatId];
    let sql = `SELECT COUNT(*)::int AS n FROM bet_followers_v2 WHERE chat_id = $1`;
    if (mode) {
      sql += ` AND mode = $2`;
      params.push(mode);
    }
    const rows = await db.execAdvanced(sql, params);
    return rows[0]?.n ?? 0;
  }

  async listByChat(chatId) {
    const rows = await db.execAdvanced(
      `SELECT apuesta_id, chat_id, mode, last_notified_status, created_at, updated_at
       FROM bet_followers_v2
       WHERE chat_id = $1
       ORDER BY updated_at DESC`,
      [chatId]
    );
    return rows.map((r) => this._toDto(r));
  }

  async listByApuesta(apuestaId, mode) {
    if (!Number.isFinite(apuestaId)) return [];
    const params = [apuestaId];
    let sql = `SELECT apuesta_id, chat_id, mode, last_notified_status, created_at, updated_at
               FROM bet_followers_v2 WHERE apuesta_id = $1`;
    if (mode) {
      sql += ` AND mode = $2`;
      params.push(mode);
    }
    const rows = await db.execAdvanced(sql, params);
    return rows.map((r) => this._toDto(r));
  }

  _toDto(row) {
    return {
      apuestaId: row.apuesta_id,
      chatId: row.chat_id,
      mode: row.mode,
      lastNotifiedStatus: row.last_notified_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { PgBetFollowerRepository };
