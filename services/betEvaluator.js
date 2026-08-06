require('dotenv').config();
const { pool } = require('../database/connection');
const db = require('../database/db');
const { PRIMARY_COMPETITION_ID: COMPETITION_ID } = require('./config');

const STATES = {
  PENDING: 'pending',
  WINNING: 'winning',
  LOSING: 'losing',
  PUSH: 'push',
};

const BET_TYPES = {
  goles_over: {
    label: 'Total de goles > {linea}',
    needsLinea: true,
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const threshold = parseFloat(sel.linea) || 0;
      return {
        status: state.totalGoals > threshold ? STATES.WINNING : (state.totalGoals === threshold ? STATES.PUSH : STATES.PENDING),
        detail: `${state.totalGoals} goles (línea ${threshold})`,
        value: state.totalGoals,
      };
    },
  },
  goles_under: {
    label: 'Total de goles < {linea}',
    needsLinea: true,
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const threshold = parseFloat(sel.linea) || 0;
      return {
        status: state.totalGoals < threshold ? STATES.WINNING : (state.totalGoals === threshold ? STATES.PUSH : STATES.LOSING),
        detail: `${state.totalGoals} goles (línea ${threshold})`,
        value: state.totalGoals,
      };
    },
  },
  ambos_marcan: {
    label: 'Ambos equipos marcan',
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const both = state.homeGoals > 0 && state.awayGoals > 0;
      return {
        status: both ? STATES.WINNING : STATES.PENDING,
        detail: both ? `${state.homeGoals}-${state.awayGoals} ✓` : `Falta que ${state.homeGoals === 0 ? 'local' : 'visitante'} marque`,
        value: both ? 1 : 0,
      };
    },
  },
  ambos_no_marcan: {
    label: 'Ningún equipo marca',
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const none = state.totalGoals === 0;
      return {
        status: state.totalGoals === 0 ? STATES.WINNING : STATES.LOSING,
        detail: none ? 'Sin goles aún' : `Ya hay goles (${state.totalGoals})`,
        value: none ? 1 : 0,
      };
    },
  },
  resultado_final: {
    label: 'Resultado final: {valor}',
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const val = (sel.valor || '').toLowerCase();
      const isLocal = val.includes('local') || val.includes('home') || val === state.homeName?.toLowerCase();
      const isAway = val.includes('visit') || val.includes('away') || val === state.awayName?.toLowerCase();
      const isDraw = val.includes('empate') || val.includes('draw') || val.includes('tie');
      let status = STATES.PENDING;
      if (isLocal && state.homeGoals > state.awayGoals) status = STATES.WINNING;
      else if (isLocal && state.homeGoals < state.awayGoals) status = STATES.LOSING;
      else if (isAway && state.awayGoals > state.homeGoals) status = STATES.WINNING;
      else if (isAway && state.awayGoals < state.homeGoals) status = STATES.LOSING;
      else if (isDraw && state.homeGoals === state.awayGoals) status = STATES.WINNING;
      else if (isDraw && state.homeGoals !== state.awayGoals) status = STATES.LOSING;
      return {
        status,
        detail: `${state.homeGoals}-${state.awayGoals} (${isLocal ? state.homeName : isAway ? state.awayName : 'empate'})`,
        value: `${state.homeGoals}-${state.awayGoals}`,
      };
    },
  },
  handicap_local: {
    label: 'Handicap local {linea}',
    needsLinea: true,
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const linea = parseFloat(sel.linea) || 0;
      const adj = state.homeGoals - linea;
      const status = adj > state.awayGoals ? STATES.WINNING : (adj < state.awayGoals ? STATES.LOSING : STATES.PUSH);
      return { status, detail: `${state.homeGoals} - ${linea} vs ${state.awayGoals}`, value: adj - state.awayGoals };
    },
  },
  handicap_visitante: {
    label: 'Handicap visitante {linea}',
    needsLinea: true,
    stateful: true,
    triggerEvents: ['goal:scored', 'match:end'],
    evaluate: (sel, state) => {
      const linea = parseFloat(sel.linea) || 0;
      const adj = state.awayGoals - linea;
      const status = adj > state.homeGoals ? STATES.WINNING : (adj < state.homeGoals ? STATES.LOSING : STATES.PUSH);
      return { status, detail: `${state.awayGoals} - ${linea} vs ${state.homeGoals}`, value: adj - state.homeGoals };
    },
  },
  tarjetas_over: {
    label: 'Total tarjetas > {linea}',
    needsLinea: true,
    stateful: true,
    triggerEvents: ['card:yellow', 'card:red', 'match:end'],
    evaluate: (sel, state) => {
      const threshold = parseFloat(sel.linea) || 0;
      return {
        status: state.totalCards > threshold ? STATES.WINNING : STATES.PENDING,
        detail: `${state.totalCards} tarjetas (línea ${threshold})`,
        value: state.totalCards,
      };
    },
  },
  corners_over: {
    label: 'Córners totales > {linea}',
    needsLinea: true,
    stateful: true,
    triggerEvents: ['corner', 'match:end'],
    evaluate: (sel, state) => {
      const threshold = parseFloat(sel.linea) || 0;
      return {
        status: state.totalCorners > threshold ? STATES.WINNING : STATES.PENDING,
        detail: `${state.totalCorners} córners (línea ${threshold})`,
        value: state.totalCorners,
      };
    },
  },
};

function extractStatsFromSnapshot(snapshot) {
  if (!snapshot || !snapshot.statistics) {
    return { homeGoals: 0, awayGoals: 0, totalGoals: 0, totalCards: 0, totalCorners: 0, homeName: '', awayName: '' };
  }
  const stats = snapshot.statistics || [];
  const byId = {};
  const homeStats = {};
  const awayStats = {};
  for (const s of stats) {
    byId[s.id] = s;
  }
  let homeGoals = 0, awayGoals = 0, totalCards = 0, totalCorners = 0;
  let homeName = '', awayName = '';
  for (const s of stats) {
    const val = parseInt(s.value) || 0;
    if (s.id === 1) {
      if (s.competitorId && homeGoals === 0 && homeName === '') {
        homeGoals = val;
        homeName = snapshot.homeCompetitor?.name || s.teamName || '';
      } else if (s.competitorId) {
        awayGoals = val;
        awayName = snapshot.awayCompetitor?.name || s.teamName || '';
      }
    } else if (s.id === 2 || s.id === 5) {
      totalCards += val;
    } else if (s.id === 6) {
      totalCorners += val;
    }
  }
  return {
    homeGoals, awayGoals,
    totalGoals: homeGoals + awayGoals,
    totalCards,
    totalCorners,
    homeName: homeName || snapshot.homeCompetitor?.name || '',
    awayName: awayName || snapshot.awayCompetitor?.name || '',
  };
}

async function getGameStateFromSupabase(gameId) {
  try {
    const r = await db.execAdvanced(
      'SELECT last_snapshot, last_status_text FROM scores365_state WHERE game_id = $1',
      [Number(gameId)]
    );
    const row = r[0];
    if (!row || !row.last_snapshot) return null;
    const snap = row.last_snapshot;
    return {
      homeGoals: snap.homeGoals ?? 0,
      awayGoals: snap.awayGoals ?? 0,
      totalGoals: (snap.homeGoals ?? 0) + (snap.awayGoals ?? 0),
      totalCards: snap.totalCards ?? 0,
      totalCorners: snap.totalCorners ?? 0,
      homeName: snap.homeName || '',
      awayName: snap.awayName || '',
    };
  } catch (e) {
    console.error('[betEvaluator] getGameState error:', e.message);
    return null;
  }
}

async function fetchTicketFromDb(ticketId) {
  try {
    const result = await db.execAdvanced(`
      SELECT a.id, a.id_usuario, a.id_partido_api, a.estado,
             json_agg(json_build_object('id', s.id, 'tipo', s.tipo_mercado, 'valor', s.valor_seleccion, 'linea', s.linea)) FILTER (WHERE s.id IS NOT NULL) as selecciones
      FROM apuestas a
      LEFT JOIN apuesta_selecciones s ON s.id_apuesta = a.id
      WHERE a.id = $1
      GROUP BY a.id
    `, [parseInt(ticketId, 10)]);
    if (result.length === 0) return null;
    return result[0];
  } catch (e) {
    console.error('[betEvaluator] fetchTicket error:', e.message);
    return null;
  }
}

async function evaluateTicket(ticket, gameState) {
  if (!ticket || !ticket.selecciones || !gameState) return null;
  const results = [];
  let overall = STATES.PENDING;
  for (const sel of ticket.selecciones) {
    const betType = BET_TYPES[sel.tipo];
    if (!betType) {
      results.push({ seleccionId: sel.id, tipo: sel.tipo, status: 'unsupported', detail: 'Tipo no soportado' });
      continue;
    }
    try {
      const evalResult = betType.evaluate(sel, gameState);
      results.push({ seleccionId: sel.id, tipo: sel.tipo, ...evalResult });
      if (evalResult.status === STATES.WINNING && (overall === STATES.PENDING || overall === STATES.WINNING)) overall = STATES.WINNING;
      else if (evalResult.status === STATES.LOSING) overall = STATES.LOSING;
      else if (evalResult.status === STATES.PUSH && overall === STATES.PENDING) overall = STATES.PUSH;
    } catch (e) {
      results.push({ seleccionId: sel.id, tipo: sel.tipo, status: 'error', detail: e.message });
    }
  }
  return {
    ticketId: ticket.id,
    status: overall,
    selecciones: results,
  };
}

function statusChanged(prev, curr) {
  if (!prev || !curr) return true;
  if (prev.status !== curr.status) return true;
  for (let i = 0; i < (prev.selecciones || []).length; i++) {
    const p = prev.selecciones[i];
    const c = (curr.selecciones || [])[i];
    if (!c) continue;
    // `?? null` (no `|| null`): con `||`, un value/status de 0 (0 goles, 0
    // tarjetas — muy común) se volvía null y reportaba cambio falso → spam de
    // notificaciones en modo outcome_only.
    if ((p?.status ?? null) !== (c.status ?? null)) return true;
    if ((p?.value ?? null) !== (c.value ?? null)) return true;
  }
  return false;
}

async function findAffectedChats(event) {
  if (!event || !event.gameId) return [];
  const out = [];
  try {
    const subs = await db.execAdvanced(
      'SELECT ticket_id, chat_ids, mode, last_notified_status FROM bet_followers WHERE game_id = $1',
      [Number(event.gameId)]
    );
    const gameState = await getGameStateFromSupabase(event.gameId);
    if (!gameState) return [];
    for (const sub of subs) {
      const ticket = await fetchTicketFromDb(sub.ticket_id);
      if (!ticket) continue;
      const evaluation = await evaluateTicket(ticket, gameState);
      if (!evaluation) continue;
      if (sub.mode === 'all_events') {
        for (const chatId of sub.chat_ids || []) {
          out.push({ chatId, ticketId: sub.ticket_id, ticket, evaluation, mode: 'all_events' });
        }
      } else if (sub.mode === 'outcome_only') {
        const lastNotified = sub.last_notified_status || {};
        const changed = statusChanged(lastNotified, evaluation);
        if (changed) {
          for (const chatId of sub.chat_ids || []) {
            out.push({ chatId, ticketId: sub.ticket_id, ticket, evaluation, mode: 'outcome_only' });
          }
          await db.execAdvanced(`
            INSERT INTO bet_followers (ticket_id, game_id, chat_ids, mode, last_notified_status, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
            ON CONFLICT (ticket_id, mode)
            DO UPDATE SET last_notified_status = EXCLUDED.last_notified_status, updated_at = NOW()
          `, [String(sub.ticket_id), Number(event.gameId), sub.chat_ids, sub.mode, JSON.stringify(evaluation)]);
        }
      }
    }
  } catch (e) {
    console.error('[betEvaluator] findAffectedChats error:', e.message);
  }
  return out;
}

module.exports = {
  STATES,
  BET_TYPES,
  extractStatsFromSnapshot,
  getGameStateFromSupabase,
  fetchTicketFromDb,
  evaluateTicket,
  findAffectedChats,
  statusChanged,
};
