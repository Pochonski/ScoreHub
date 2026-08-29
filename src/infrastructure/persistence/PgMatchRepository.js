/**
 * src/infrastructure/persistence/PgMatchRepository.js — Adapter pg/Supabase para IMatchRepository.
 *
 * Tabla: `games` (migration 004). Las columnas indexadas cubren los filtros
 * del repo (`competition_id`, `start_time`); `data` JSONB carga el detalle
 * completo de la API upstream.
 *
 * Ruteo por `database/db.js`:
 *   - Simple lookups (`findById`)        → db.query (Supabase HTTP primary, pg fallback)
 *   - Filtros con rango temporal         → db.execAdvanced (pg pool, necesita DATE() sobre timestamptz)
 *   - Latest standing (ORDER BY + LIMIT) → db.execAdvanced (jsonb pesado)
 *
 * Mapeo: fila cruda (snake_case + columnas sueltas) → MatchDTO (camelCase,
 * shape del dominio). Los campos en `data` se preservan como `rawData` para
 * no romper callers que esperan el shape upstream; nuevos use-cases deben
 * preferir las columnas tipadas.
 */

const db = require('../../../database/db');

class PgMatchRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async findById(id) {
    const { data, error } = await db.query('games', {
      eq: { id },
      maybeSingle: true,
    });
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? this._toMatchDto(data) : null;
  }

  async findByCompetitionAndDate(competitionId, dateStr) {
    // DATE() sobre timestamptz necesita pg; Supabase HTTP no soporta operadores de fecha
    // arbitrarios sin una columna generated. Migración a índice funcional queda como follow-up.
    const rows = await db.execAdvanced(
      `SELECT * FROM games
       WHERE competition_id = $1
         AND DATE(start_time AT TIME ZONE 'UTC') = $2
       ORDER BY start_time ASC`,
      [competitionId, dateStr]
    );
    return rows.map((r) => this._toMatchDto(r));
  }

  async findRecentByCompetition(competitionId, { limit = 20 } = {}) {
    const rows = await db.execAdvanced(
      `SELECT * FROM games
       WHERE competition_id = $1
       ORDER BY start_time DESC
       LIMIT $2`,
      [competitionId, limit]
    );
    return rows.map((r) => this._toMatchDto(r));
  }

  async findLatestStanding(competitionId) {
    const rows = await db.execAdvanced(
      `SELECT * FROM standings
       WHERE competition_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [competitionId]
    );
    if (!rows.length) return null;
    return this._toStandingDto(rows[0]);
  }

  // --- DTO mapping -------------------------------------------------------

  _toMatchDto(row) {
    const d = row.data || {};
    return {
      id: row.id,
      competitionId: row.competition_id,
      statusGroup: row.status_group,
      statusText: row.status_text,
      startTime: row.start_time,
      stage: row.stage,
      seasonNum: row.season_num,
      homeCompetitor: {
        id: row.home_competitor_id,
        name: d.homeCompetitor?.name ?? null,
        score: row.home_score,
      },
      awayCompetitor: {
        id: row.away_competitor_id,
        name: d.awayCompetitor?.name ?? null,
        score: row.away_score,
      },
      // Preservamos el JSONB upstream completo. Nuevos use-cases deben preferir
      // los campos tipados arriba; este campo es para compatibilidad.
      rawData: d,
    };
  }

  _toStandingDto(row) {
    return {
      competitionId: row.competition_id,
      stageNum: row.stage_num,
      data: row.data,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { PgMatchRepository };
