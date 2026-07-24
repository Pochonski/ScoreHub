require('dotenv').config();
const context = require('../services/conversationContext');
const db = require('../database/db');

const MAX_FOLLOWS_PER_CHAT = 10;
const DEFAULT_MODE = 'all_events';

const MODE_LABELS = {
  all_events: 'todos los eventos (goles, tarjetas, etc.)',
  outcome_only: 'solo cuando sepas si ganaste o perdiste',
};

const VALID_MODES = ['all_events', 'outcome_only'];

/* ------------------------------------------------------------------ */
/* Low-level DB ops on `bet_followers_v2` (migration 019).            */
/* One row per (apuesta_id, chat_id, mode). Replaces the legacy      */
/* `bet_followers(ticket_id TEXT, chat_ids TEXT[])` which had no FK.   */
/* ------------------------------------------------------------------ */

async function getTicketInfo(apuestaId) {
  try {
    const r = await db.execAdvanced(
      `SELECT a.id, a.id_usuario, a.id_partido_api, a.estado, a.partido_extrado
         FROM apuestas a
        WHERE a.id = $1`,
      [parseInt(apuestaId, 10)]
    );
    return r[0] || null;
  } catch (e) {
    console.error('[followHandler] getTicketInfo error:', e.message);
    return null;
  }
}

async function getFollowsByApuesta(apuestaId, mode = DEFAULT_MODE) {
  try {
    const r = await db.execAdvanced(
      `SELECT apuesta_id, chat_id, mode, last_notified_status, created_at, updated_at
         FROM bet_followers_v2
        WHERE apuesta_id = $1 AND mode = $2`,
      [parseInt(apuestaId, 10), mode]
    );
    return r;
  } catch (_) {
    return [];
  }
}

async function countFollowsByChat(chatId, mode = DEFAULT_MODE) {
  try {
    const r = await db.execAdvanced(
      `SELECT COUNT(*)::int AS n
         FROM bet_followers_v2
        WHERE chat_id = $1 AND mode = $2`,
      [chatId, mode]
    );
    return r[0]?.n ?? 0;
  } catch (_) {
    return 0;
  }
}

async function getFollowForUser(apuestaId, chatId) {
  try {
    const r = await db.execAdvanced(
      `SELECT apuesta_id, chat_id, mode, last_notified_status
         FROM bet_followers_v2
        WHERE apuesta_id = $1 AND chat_id = $2
        ORDER BY mode
        LIMIT 1`,
      [parseInt(apuestaId, 10), chatId]
    );
    return r[0] || null;
  } catch (_) {
    return null;
  }
}

async function upsertFollowForUser(apuestaId, chatId, mode, lastNotifiedStatus = null) {
  await db.execAdvanced(
    `INSERT INTO bet_followers_v2
       (apuesta_id, chat_id, mode, last_notified_status, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, now())
     ON CONFLICT (apuesta_id, chat_id, mode) DO UPDATE
       SET last_notified_status = COALESCE(EXCLUDED.last_notified_status, bet_followers_v2.last_notified_status),
           updated_at = now()`,
    [
      parseInt(apuestaId, 10),
      chatId,
      mode,
      lastNotifiedStatus ? JSON.stringify(lastNotifiedStatus) : null,
    ]
  );
}

async function deleteFollowForUser(apuestaId, chatId, mode) {
  await db.execAdvanced(
    `DELETE FROM bet_followers_v2
      WHERE apuesta_id = $1 AND chat_id = $2 AND mode = $3`,
    [parseInt(apuestaId, 10), chatId, mode]
  );
}

async function listFollowsByChat(chatId) {
  try {
    const r = await db.execAdvanced(
      `SELECT apuesta_id, mode, last_notified_status, created_at, updated_at
         FROM bet_followers_v2
        WHERE chat_id = $1
        ORDER BY updated_at DESC`,
      [chatId]
    );
    return r;
  } catch (_) {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* High-level user-facing ops                                            */
/* ------------------------------------------------------------------ */

async function followTicket(chatIdStr, apuestaId, mode = DEFAULT_MODE) {
  const ticket = await getTicketInfo(apuestaId);
  if (!ticket) {
    return { ok: false, message: `❌ No encontré el ticket #${apuestaId}. Verifica que exista.` };
  }
  if (ticket.id_usuario !== chatIdStr) {
    return { ok: false, message: `❌ El ticket #${apuestaId} no es tuyo.` };
  }
  if (!['abierta'].includes(ticket.estado)) {
    return { ok: false, message: `❌ El ticket #${apuestaId} ya está ${ticket.estado}.` };
  }

  const aid = parseInt(apuestaId, 10);
  if (!Number.isFinite(aid)) {
    return { ok: false, message: '❌ ticketId inválido.' };
  }

  // ¿Ya lo sigue en ALGÚN modo?
  const existing = await getFollowForUser(aid, chatIdStr);
  if (existing) {
    if (existing.mode === mode) {
      return {
        ok: true,
        message: `✅ Ya estás siguiendo el ticket #${apuestaId} en este modo (${MODE_LABELS[mode]}).`,
      };
    }
    // El usuario quiere cambiar de modo. Reemplazamos.
    await deleteFollowForUser(aid, chatIdStr, existing.mode);
  }

  // Límite de follows por chat (en ESTE modo, para no explotar).
  const currentCount = await countFollowsByChat(chatIdStr, mode);
  if (currentCount >= MAX_FOLLOWS_PER_CHAT) {
    return {
      ok: false,
      message: `⚠️ Llegaste al máximo de ${MAX_FOLLOWS_PER_CHAT} tickets seguidos en modo ${mode}.`,
    };
  }

  await upsertFollowForUser(aid, chatIdStr, mode, null);

  context.rememberTicket(chatIdStr, String(aid));
  return {
    ok: true,
    message: `✅ Listo, sigo tu ticket #${apuestaId} (${ticket.partido_extrado || `partido ${ticket.id_partido_api}`}). Te aviso con ${MODE_LABELS[mode]}.\n\n💡 Tip: para cambiar el modo usa "/follow ${apuestaId} outcome" o "/follow ${apuestaId} all".`,
  };
}

async function unfollowTicket(chatIdStr, apuestaId) {
  const aid = parseInt(apuestaId, 10);
  if (!Number.isFinite(aid)) {
    return { ok: false, message: '❌ ticketId inválido.' };
  }

  // Borra todos los modos para este chat y este ticket.
  const exists = await db.execAdvanced(
    `SELECT 1 FROM bet_followers_v2 WHERE apuesta_id = $1 AND chat_id = $2 LIMIT 1`,
    [aid, chatIdStr]
  );
  if (!exists.length) {
    return { ok: false, message: `❌ No sigues el ticket #${apuestaId}.` };
  }
  await db.execAdvanced(
    `DELETE FROM bet_followers_v2 WHERE apuesta_id = $1 AND chat_id = $2`,
    [aid, chatIdStr]
  );
  return { ok: true, message: `✅ Dejé de seguir el ticket #${apuestaId}.` };
}

async function listFollowed(chatIdStr) {
  try {
    const rows = await listFollowsByChat(chatIdStr);
    if (rows.length === 0) {
      return { ok: true, message: '📭 No sigues ningún ticket todavía. Probá: "/follow 555" (con un ticket tuyo).' };
    }

    const lines = ['📋 *Tickets que sigues:*\n'];
    for (const sub of rows) {
      const ticket = await getTicketInfo(sub.apuesta_id);
      const modeIcon = sub.mode === 'outcome_only' ? '🎯' : '📡';
      const partido = ticket?.partido_extrado || `ticket #${sub.apuesta_id}`;
      lines.push(`${modeIcon} *#${sub.apuesta_id}* — ${partido}`);
      lines.push(`   Modo: ${MODE_LABELS[sub.mode] || sub.mode}`);
      if (ticket) lines.push(`   Estado: ${ticket.estado}`);
      lines.push('');
    }
    lines.push('💡 Para dejar de seguir: /unfollow <id>');
    return { ok: true, message: lines.join('\n') };
  } catch (e) {
    return { ok: false, message: `❌ Error listando: ${e.message}` };
  }
}

async function changeMode(chatIdStr, apuestaId, newMode) {
  if (!VALID_MODES.includes(newMode)) {
    return { ok: false, message: '❌ Modo inválido. Usa "all" o "outcome".' };
  }
  const aid = parseInt(apuestaId, 10);
  if (!Number.isFinite(aid)) {
    return { ok: false, message: '❌ ticketId inválido.' };
  }

  const existing = await getFollowForUser(aid, chatIdStr);
  if (!existing) {
    return { ok: false, message: `❌ No sigues el ticket #${apuestaId}. Primero: /follow ${apuestaId}` };
  }
  if (existing.mode === newMode) {
    return { ok: true, message: `✅ El ticket #${apuestaId} ya estaba en modo "${MODE_LABELS[newMode]}".` };
  }

  // Borra el viejo y crea el nuevo (on-conflict en PK compuesta).
  await deleteFollowForUser(aid, chatIdStr, existing.mode);
  await upsertFollowForUser(aid, chatIdStr, newMode, null);
  return { ok: true, message: `✅ Ticket #${apuestaId}: modo cambiado a "${MODE_LABELS[newMode]}".` };
}

/* ------------------------------------------------------------------ */
/* Slash-command / NL intent handlers                                   */
/* ------------------------------------------------------------------ */

async function handleFollowCommand(chatIdStr, args) {
  const parts = (args || '').trim().split(/\s+/);
  const ticketId = parts[0];
  const modeArg = (parts[1] || '').toLowerCase();
  let mode = DEFAULT_MODE;
  if (modeArg === 'all' || modeArg === 'all_events' || modeArg === 'todo' || modeArg === 'todos') mode = 'all_events';
  else if (modeArg === 'outcome' || modeArg === 'outcome_only' || modeArg === 'final' || modeArg === 'solo') mode = 'outcome_only';
  if (!ticketId) {
    return { ok: false, message: '❌ Uso: /follow <ticketId> [all|outcome]' };
  }
  if (!/^\d+$/.test(ticketId)) {
    return { ok: false, message: '❌ ticketId debe ser numérico.' };
  }
  return await followTicket(chatIdStr, ticketId, mode);
}

async function handleUnfollowCommand(chatIdStr, args) {
  const ticketId = (args || '').trim().split(/\s+/)[0];
  if (!ticketId) return { ok: false, message: '❌ Uso: /unfollow <ticketId>' };
  if (!/^\d+$/.test(ticketId)) return { ok: false, message: '❌ ticketId debe ser numérico.' };
  return await unfollowTicket(chatIdStr, ticketId);
}

async function handleListCommand(chatIdStr) {
  return await listFollowed(chatIdStr);
}

async function handleIntentFollow(chatIdStr, intent) {
  const ticketId = intent.ticketId;
  if (!ticketId) {
    return { ok: false, message: '🤔 No entendí qué ticket. Decime: "sígueme el 555" (con el número).' };
  }
  const mode = intent.mode === 'outcome_only' ? 'outcome_only' : 'all_events';
  return await followTicket(chatIdStr, ticketId, mode);
}

async function handleIntentUnfollow(chatIdStr, intent) {
  const ticketId = intent.ticketId;
  if (!ticketId) {
    return { ok: false, message: '🤔 No entendí qué ticket. Decime: "deja de seguir el 555".' };
  }
  return await unfollowTicket(chatIdStr, ticketId);
}

async function handleIntentChangeMode(chatIdStr, intent) {
  const ticketId = intent.ticketId;
  const mode = intent.mode;
  if (!ticketId) {
    return { ok: false, message: '🤔 No entendí qué ticket. Decime: "cambia el 555 a solo cuando gane".' };
  }
  if (!mode) {
    return { ok: false, message: '🤔 No entendí a qué modo cambiar. Opciones: "all" o "outcome".' };
  }
  return await changeMode(chatIdStr, ticketId, mode);
}

module.exports = {
  followTicket,
  unfollowTicket,
  listFollowed,
  changeMode,
  getTicketInfo,
  // Back-compat with any caller that used the old name (returns mode-specific rows)
  getFollowByTicketId: getFollowsByApuesta,
  handleFollowCommand,
  handleUnfollowCommand,
  handleListCommand,
  handleIntentFollow,
  handleIntentUnfollow,
  handleIntentChangeMode,
  MAX_FOLLOWS_PER_CHAT,
  MODE_LABELS,
};
