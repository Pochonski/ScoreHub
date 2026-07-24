const db = require('../../../database/db');
const scores365 = require('../../../services/scores365Service');
const images = require('../../../services/images');
const { resolveCompetition } = require('../utils/competition');

/**
 * GET /competitions/:id/transfers?teamId=9076
 * Devuelve los fichajes de una competición, opcionalmente filtrados por equipo.
 * Cache: tabla `competition_transfers` (sync cada 30 min).
 * Fallback: upstream en vivo si la cache está vacía.
 *
 * Implementación Fase 4: el join de 3 tablas (competition_transfers +
 * athletes + competitors × 2) no se puede expresar con PostgREST simple,
 * así que la query principal usa execAdvanced (pg). Otros lookups sí
 * pasan por HTTP.
 */
async function getCompetitionTransfers(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const competitionId = resolved.competitionId;

    const teamId = req.query.teamId != null ? parseInt(req.query.teamId, 10) : null;

    const baseSql = `SELECT ct.*,
                            a.name AS athlete_name,
                            a.data->>'shortName' AS athlete_short_name,
                            o.name AS origin_name,
                            o.data->>'shortName' AS origin_short_name,
                            t.name AS target_name,
                            t.data->>'shortName' AS target_short_name
                       FROM competition_transfers ct
                  LEFT JOIN athletes a ON a.id = ct.athlete_id
                  LEFT JOIN competitors o ON o.id = ct.origin_id
                  LEFT JOIN competitors t ON t.id = ct.target_id`;
    let rows;
    if (teamId) {
      rows = await db.execAdvanced(
        `${baseSql}
          WHERE ct.competition_id = $1
            AND (ct.origin_id = $2 OR ct.target_id = $2)
          ORDER BY ct.time DESC NULLS LAST, ct.transfer_id DESC`,
        [competitionId, teamId]
      );
    } else {
      rows = await db.execAdvanced(
        `${baseSql}
          WHERE ct.competition_id = $1
          ORDER BY ct.time DESC NULLS LAST, ct.transfer_id DESC`,
        [competitionId]
      );
    }

    if (!rows.length) {
      try {
        const data = await scores365.getTransfers(competitionId, { limit: 100 });
        const list = (data?.transfers ?? []).map(t => mapTransfer(t, competitionId));
        return res.json(list);
      } catch (_) {
        return res.json([]);
      }
    }

    res.json(rows.map(r => ({
      id: Number(r.transfer_id),
      athleteId: r.athlete_id != null ? Number(r.athlete_id) : null,
      athleteName: r.athlete_name || null,
      athleteShortName: r.athlete_short_name || null,
      originId: r.origin_id != null ? Number(r.origin_id) : null,
      originName: r.origin_name || null,
      targetId: r.target_id != null ? Number(r.target_id) : null,
      targetName: r.target_name || null,
      time: r.time,
      price: r.price,
      positionId: r.position_id != null ? Number(r.position_id) : null,
      isArrival: r.is_arrival,
      isDeparture: r.is_departure,
      statusId: r.status_id != null ? Number(r.status_id) : null,
      statusName: r.status_name,
      data: r.data,
    })));
  } catch (err) {
    next(err);
  }
}

/**
 * Devuelve fichajes agrupados por equipo (in/out counts).
 * Útil para el tab "Fichajes" en /competicion/:id.
 */
async function getCompetitionTransfersSummary(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const competitionId = resolved.competitionId;

    // Equipos que juegan en esta competición — basados en la junction table
    // `competition_competitors` (Phase 5 migration 018). Reemplaza la query
    // por `games` que era ineficiente y limitada a equipos con partidos
    // programados.
    const teams = await db.execAdvanced(
      `SELECT DISTINCT t.id, t.name, t.data
         FROM competitors t
         JOIN competition_competitors cc ON cc.competitor_id = t.id
        WHERE cc.competition_id = $1
          AND cc.season_num = $2
          AND t.id IN (
            SELECT origin_id FROM competition_transfers WHERE competition_id = $1 AND origin_id IS NOT NULL
            UNION
            SELECT target_id FROM competition_transfers WHERE competition_id = $1 AND target_id IS NOT NULL
          )`,
      [competitionId, resolved.seasonNum]
    );
    const teamMap = new Map(teams.map(t => [Number(t.id), {
      id: Number(t.id),
      name: t.name,
      shortName: t.data?.shortName ?? null,
      imageVersion: t.data?.imageVersion ?? 1,
      badgeUrl: images.getTeamBadgeUrl(t.id, t.data?.imageVersion ?? 1),
    }]));

    const rows = await db.execAdvanced(
      `WITH transfers_split AS (
         SELECT origin_id AS team_id, 'departure'::text AS kind
           FROM competition_transfers
          WHERE competition_id = $1 AND origin_id IS NOT NULL
         UNION ALL
         SELECT target_id AS team_id, 'arrival'::text AS kind
           FROM competition_transfers
          WHERE competition_id = $1 AND target_id IS NOT NULL
       )
       SELECT team_id,
              COUNT(*) FILTER (WHERE kind = 'arrival')::int   AS arrivals,
              COUNT(*) FILTER (WHERE kind = 'departure')::int AS departures,
              COUNT(*)::int AS total
         FROM transfers_split
        GROUP BY team_id
        ORDER BY total DESC`,
      [competitionId]
    );

    const summary = rows
      .filter(r => r.team_id != null && teamMap.has(Number(r.team_id)))
      .map(r => {
        const tid = Number(r.team_id);
        const t = teamMap.get(tid);
        return {
          teamId: tid,
          name: t.name || `#${tid}`,
          shortName: t.shortName ?? null,
          badgeUrl: images.getTeamBadgeUrl(tid, t.imageVersion ?? 1),
          arrivals: Number(r.arrivals),
          departures: Number(r.departures),
        };
      });

    res.json(summary);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /suggestions?competitionId=X
 * Devuelve sugerencias de partidos cacheadas.
 */
async function getGameSuggestions(req, res, next) {
  try {
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    const { data, error } = await db.query('game_suggestions', {
      select: 'data',
      eq: { competition_id: competitionId },
      order: [
        { column: 'rank', asc: true },
        { column: 'game_id', asc: true },
      ],
    });
    if (error) throw error;

    if (!data || !data.length) {
      try {
        const fallback = await scores365.getGameSuggestions(competitionId);
        return res.json((fallback?.suggestedGames ?? []).map(g => g));
      } catch (_) {
        return res.json([]);
      }
    }

    res.json(data.map(r => r.data));
  } catch (err) {
    next(err);
  }
}

function mapTransfer(t, competitionId) {
  return {
    id: Number(t.id),
    athleteId: t.athleteId != null ? Number(t.athleteId) : null,
    athleteName: t.athleteName || null,
    athleteShortName: t.athleteShortName || null,
    originId: t.origin != null ? Number(t.origin) : null,
    targetId: t.target != null ? Number(t.target) : null,
    time: t.time ?? null,
    price: t.price ?? null,
    positionId: t.positionId != null ? Number(t.positionId) : null,
    isArrival: !!t.isArrival,
    isDeparture: !!t.isDeparture,
    statusId: t.statusId != null ? Number(t.statusId) : null,
    statusName: t.statusName ?? null,
    competitionId,
  };
}

module.exports = {
  getCompetitionTransfers,
  getCompetitionTransfersSummary,
  getGameSuggestions,
};
