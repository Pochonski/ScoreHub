/**
 * src/infrastructure/persistence/PgStatsRepository.js — Adapter para IStatsRepository.
 *
 * Todas las queries usan `db.execAdvanced` (pg pool) porque operan sobre
 * columnas JSONB con operadores (-> / ->>) que Supabase HTTP no soporta
 * directamente.
 */

const db = require('../../../database/db');

class PgStatsRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async getNews(competitionId, scope = 'competition', limit = 50) {
    const rows = await db.execAdvanced(
      `SELECT data FROM news
       WHERE scope = $1 AND entity_id = $2
       ORDER BY publish_date DESC NULLS LAST
       LIMIT $3`,
      [scope, competitionId, limit]
    );
    return rows.map((r) => ({ data: r.data }));
  }

  async getTeamOfWeek(competitionId) {
    const rows = await db.execAdvanced(
      'SELECT data FROM team_of_week WHERE competition_id = $1',
      [competitionId]
    );
    if (!rows.length) return null;
    return { competitionId, data: rows[0].data };
  }

  async getBracket(competitionId) {
    const rows = await db.execAdvanced(
      'SELECT data FROM brackets WHERE competition_id = $1',
      [competitionId]
    );
    if (!rows.length) return null;
    return { competitionId, data: rows[0].data };
  }

  async getCompetitionHistory(competitionId) {
    const rows = await db.execAdvanced(
      `SELECT data, (data->>'seasonNum')::int AS season_num
       FROM competition_history
       WHERE competition_id = $1
       ORDER BY season_num DESC`,
      [competitionId]
    );
    return rows.map((r) => ({
      competitionId,
      seasonNum: r.season_num,
      data: r.data,
    }));
  }

  async getLatestTournamentStats(competitionId) {
    const rows = await db.execAdvanced(
      `SELECT data FROM tournament_stats
       WHERE competition_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [competitionId]
    );
    if (!rows.length) return null;
    return { competitionId, data: rows[0].data };
  }
}

module.exports = { PgStatsRepository };
