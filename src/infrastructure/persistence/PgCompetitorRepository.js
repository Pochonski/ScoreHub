/**
 * src/infrastructure/persistence/PgCompetitorRepository.js — Adapter para ICompetitorRepository.
 *
 * Tabla: `competitors` (migration 004). El documento JSONB en `data` lleva
 * el nombre canónico, país, badge URL, etc.; la columna indexada `name`
 * permite lookups rápidos sin parsear JSONB.
 */

const db = require('../../../database/db');

class PgCompetitorRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async findById(id) {
    const { data, error } = await db.query('competitors', {
      eq: { id },
      maybeSingle: true,
    });
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? this._toDto(data) : null;
  }

  async findByCompetition(competitionId) {
    const { data, error } = await db.query('competitors', {
      eq: { competition_id: competitionId },
      order: { column: 'name', asc: true },
    });
    if (error) throw error;
    return (data || []).map((r) => this._toDto(r));
  }

  _toDto(row) {
    const d = row.data || {};
    return {
      id: row.id,
      competitionId: row.competition_id,
      name: row.name ?? d.name ?? null,
      data: d,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { PgCompetitorRepository };
