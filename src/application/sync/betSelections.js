/**
 * src/application/sync/betSelections.js — Fase 8.6+
 *
 * Sync que evalúa selecciones de apuestas pendientes y actualiza
 * `apuesta_selecciones.estado` + `valor_actual` cuando el partido
 * asociado termina.
 *
 * Hasta Fase 8.6, las selecciones se actualizaban solo cuando:
 *   1. El bot evaluaba manualmente (betTrackingEngine.js)
 *   2. El usuario hacía una consulta específica
 *
 * Este sync agrega una verificación periódica automática (cada 2 min)
 * para que las selecciones se actualicen sin intervención del bot.
 *
 * Lógica:
 *   1. Encuentra apuestas 'abiertas' con selecciones 'pendientes'
 *   2. Verifica si el partido asociado terminó (status_group=4 en games)
 *   3. Si terminó, evalúa cada selección con betEvaluator.js
 *   4. Actualiza apuesta_selecciones.estado y valor_actual
 *   5. Si todas las selecciones están resueltas, marca la apuesta como 'completada'
 */

const {
  api, pool, withTransaction, db, getActiveCompetitions, forEachActive, logger,
  log, logErr, newSyncRunId,
  upsertMany, upsertCompetitorCanonical, upsertCompetitorReference,
  upsertAthleteCanonical, upsertRosterMembership, upsertGames,
  upsertCompetitionCompetitorsFromStandings, upsertCompetitionCompetitorsFromGames,
} = require('./context');

const betEvaluator = require('../../../services/betEvaluator');

const { STATES } = betEvaluator;

/**
 * Sincroniza selecciones de apuestas: evalúa y actualiza estado.
 * Lee apuestas con selecciones 'pendientes' cuyo partido terminó.
 */
async function syncBetSelections() {
  log('Evaluating bet selections (pending → win/lose/push)...');
  try {
    // 1. Encuentra selecciones pendientes en apuestas abiertas/cerradas
    //    cuyo partido asociado terminó (status_group=4).
    const result = await db.execAdvanced(`
      SELECT
        s.id              AS seleccion_id,
        s.id_apuesta      AS apuesta_id,
        s.tipo_mercado    AS tipo_mercado,
        s.valor_seleccion AS valor_seleccion,
        s.linea           AS linea,
        s.estado          AS estado_actual,
        a.id_partido_api  AS game_id,
        a.estado          AS apuesta_estado,
        g.status_group    AS game_status,
        g.home_competitor_id,
        g.away_competitor_id,
        g.home_score      AS marcador_local,
        g.away_score      AS marcador_visitante
      FROM apuesta_selecciones s
      JOIN apuestas a           ON a.id = s.id_apuesta
      LEFT JOIN games g         ON g.id = a.id_partido_api
      WHERE s.estado = 'pendiente'
        AND a.estado IN ('abierta', 'cerrada')
        AND g.id IS NOT NULL
        AND g.status_group = 4
      ORDER BY a.fecha_creacion DESC
      LIMIT 50
    `);
    if (!result.length) {
      log('No pending selections to evaluate');
      return;
    }
    log(`Evaluating ${result.length} pending selections`);

    // 2. Para cada selección, evalúa con betEvaluator
    let updated = 0;
    let failed = 0;
    for (const sel of result) {
      try {
        // Construir el gameState para el evaluador
        const gameState = {
          totalGoals: (sel.marcador_local || 0) + (sel.marcador_visitante || 0),
          goalsHome: sel.marcador_local,
          goalsAway: sel.marcador_visitante,
          status: 'finished',
        };
        // Construir el objeto selección como lo espera el evaluador
        const seleccionObj = {
          id: sel.seleccion_id,
          tipo: sel.tipo_mercado,
          valor: sel.valor_seleccion,
          linea: sel.linea,
        };
        // Buscar el betType
        const betType = betEvaluator.BET_TYPES?.[sel.tipo_mercado];
        if (!betType) {
          logErr(`  seleccion ${sel.seleccion_id}: tipo_mercado '${sel.tipo_mercado}' no soportado`);
          failed++;
          continue;
        }
        const evalResult = betType.evaluate(seleccionObj, gameState);
        const newStatus = evalResult.status;
        const newValue = evalResult.value ?? null;
        const newDetail = evalResult.detail ?? null;

        // 3. Update selección
        await db.execAdvanced(
          `UPDATE apuesta_selecciones
           SET estado = $1, valor_actual = $2, detalle = $3
           WHERE id = $4`,
          [newStatus, newValue, newDetail, sel.seleccion_id]
        );
        updated++;
      } catch (e) {
        logErr(`  seleccion ${sel.seleccion_id}: ${e.message}`);
        failed++;
      }
    }

    log(`Updated ${updated} selections, ${failed} failed`);

    // 4. Si una apuesta tiene todas las selecciones resueltas, marcarla
    //    como 'completada'.
    await markCompletedApuestas();
  } catch (e) {
    logErr(`Error syncing bet selections: ${e.message}`);
  }
}

/**
 * Marca apuestas como 'completada' si todas sus selecciones están
 * resueltas (no 'pendiente').
 */
async function markCompletedApuestas() {
  const result = await db.execAdvanced(`
    UPDATE apuestas a
    SET estado = 'completada'
    WHERE estado = 'cerrada'
      AND NOT EXISTS (
        SELECT 1 FROM apuesta_selecciones s
        WHERE s.id_apuesta = a.id AND s.estado = 'pendiente'
      )
    RETURNING id
  `);
  if (result.length) {
    log(`Marked ${result.length} apuestas as 'completada'`);
  }
}

module.exports = { syncBetSelections, markCompletedApuestas };