/**
 * src/infrastructure/persistence/PgCompetitionRepository.js — Adapter para ICompetitionRepository.
 *
 * Tablas: `competitions` (catálogo, migration 004) y `active_competitions`
 * (migration 008) — esta última es un subset curado de IDs visibles para el bot.
 *
 * Los nombres legibles se leen desde `competitions.data->>name` o
 * `competitions.data->displayName` según el payload upstream; el adapter
 * expone el primero disponible y deja el JSONB completo en `data` para que
 * los presenters elijan.
 */

const db = require('../../../database/db');

class PgCompetitionRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async findById(id) {
    const { data, error } = await db.query('competitions', {
      eq: { id },
      maybeSingle: true,
    });
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? this._toDto(data) : null;
  }

  async findAll() {
    const { data, error } = await db.query('competitions', {
      order: { column: 'id', asc: true },
    });
    if (error) throw error;
    return (data || []).map((r) => this._toDto(r));
  }

  async findActiveIds() {
    const { data, error } = await db.query('active_competitions', {
      select: 'competition_id',
      order: { column: 'competition_id', asc: true },
    });
    if (error) throw error;
    return (data || []).map((r) => r.competition_id).filter(Number.isFinite);
  }

  _toDto(row) {
    const d = row.data || {};
    return {
      id: row.id,
      name: d.name ?? d.displayName ?? null,
      data: d,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { PgCompetitionRepository };
