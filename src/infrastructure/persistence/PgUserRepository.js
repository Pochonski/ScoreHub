/**
 * src/infrastructure/persistence/PgUserRepository.js — Adapter para IUserRepository.
 *
 * Tablas: `usuarios` (registro de chatId → alias) y `equipos_seguidos`
 * (suscripciones a equipos). Las migraciones 003 y 019 introdujeron
 * `bet_followers` (v1 obsoleta, dropeada en 025; v2 con payload JSONB).
 *
 * Las writes (`upsert`, `addFollowedTeam`, `removeFollowedTeam`) necesitan
 * UNIQUE-aware upsert y la constraint UNIQUE (id_usuario, id_equipo) de
 * equipos_seguidos, por eso caen en `db.upsert`/`db.execAdvanced`.
 */

const db = require('../../../database/db');

class PgUserRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async findById(userId) {
    const { data, error } = await db.query('usuarios', {
      eq: { id: userId },
      maybeSingle: true,
    });
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? this._toUserDto(data) : null;
  }

  async upsert(userId, alias) {
    const { data, error } = await db.upsert(
      'usuarios',
      [{ id: userId, alias, estado: 'registrado' }],
      'id',
      { select: '*' }
    );
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return this._toUserDto(row);
  }

  async addFollowedTeam(userId, teamId, teamName) {
    // ON CONFLICT DO NOTHING (la constraint UNIQUE ya está en el schema).
    const { error } = await db.insert(
      'equipos_seguidos',
      [{ id_usuario: userId, id_equipo: teamId, nombre_equipo: teamName }],
      { onConflict: 'id_usuario,id_equipo' }
    );
    // PGRST duplicates son no-op en Supabase, pero pg fallback tira constraint
    // violation. La semántica del repo es idempotente, así que tragamos el error.
    if (error && error.code !== '23505') throw error;
  }

  async removeFollowedTeam(userId, teamId) {
    const { error } = await db.remove('equipos_seguidos', {
      eq: { id_usuario: userId, id_equipo: teamId },
    });
    if (error) throw error;
  }

  async listFollowedTeams(userId) {
    const rows = await db.execAdvanced(
      `SELECT id_usuario, id_equipo, nombre_equipo, fecha_seguimiento
       FROM equipos_seguidos
       WHERE id_usuario = $1
       ORDER BY fecha_seguimiento DESC`,
      [userId]
    );
    return rows.map((r) => this._toFollowedDto(r));
  }

  // --- DTO mapping -------------------------------------------------------

  _toUserDto(row) {
    return {
      id: row.id,
      alias: row.alias,
      fechaRegistro: row.fecha_registro,
      estado: row.estado,
    };
  }

  _toFollowedDto(row) {
    return {
      userId: row.id_usuario,
      teamId: row.id_equipo,
      teamName: row.nombre_equipo,
      fechaSeguimiento: row.fecha_seguimiento,
    };
  }
}

module.exports = { PgUserRepository };
