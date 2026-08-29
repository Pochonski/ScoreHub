/**
 * src/application/bets/followTicket.js — Use-case para seguir/dejar tickets de apuesta (Fase 8).
 *
 * Encapsula la lógica de `handlers/followHandler.js`:
 *   - Validar que el ticket exista y sea del usuario
 *   - Respetar el límite MAX_FOLLOWS_PER_CHAT por modo
 *   - Manejar el cambio de modo (delete viejo + upsert nuevo)
 *   - Devolver `{ ok, message }` listo para enviar al chat
 *
 * La lógica de rememberTicket (`conversationContext`) se inyecta como dep
 * opcional para que el use-case sea testeable sin tocar el módulo global.
 */

const MAX_FOLLOWS_PER_CHAT = 10;
const DEFAULT_MODE = 'all_events';

const MODE_LABELS = {
  all_events: 'todos los eventos (goles, tarjetas, etc.)',
  outcome_only: 'solo cuando sepas si ganaste o perdiste',
};

const VALID_MODES = ['all_events', 'outcome_only'];

function normalizeMode(arg) {
  if (!arg) return DEFAULT_MODE;
  const a = String(arg).toLowerCase();
  if (a === 'all' || a === 'all_events' || a === 'todo' || a === 'todos') return 'all_events';
  if (a === 'outcome' || a === 'outcome_only' || a === 'final' || a === 'solo') return 'outcome_only';
  return DEFAULT_MODE;
}

function createFollowTicketUseCase({
  betFollowerRepository,
  rememberTicket = () => {},
  maxFollowsPerChat = MAX_FOLLOWS_PER_CHAT,
  defaultMode = DEFAULT_MODE,
  modeLabels = MODE_LABELS,
  validModes = VALID_MODES,
}) {
  if (!betFollowerRepository) {
    throw new Error('createFollowTicketUseCase: betFollowerRepository is required');
  }

  async function followTicket(chatId, ticketId, mode = defaultMode) {
    const aid = parseInt(ticketId, 10);
    if (!Number.isFinite(aid)) {
      return { ok: false, message: '❌ ticketId inválido.' };
    }
    if (!validModes.includes(mode)) {
      return { ok: false, message: `❌ modo inválido "${mode}".` };
    }

    const ticket = await betFollowerRepository.getTicketSummary(aid);
    if (!ticket) {
      return { ok: false, message: `❌ No encontré el ticket #${aid}. Verifica que exista.` };
    }
    if (ticket.idUsuario !== String(chatId)) {
      return { ok: false, message: `❌ El ticket #${aid} no es tuyo.` };
    }
    if (!['abierta'].includes(ticket.estado)) {
      return { ok: false, message: `❌ El ticket #${aid} ya está ${ticket.estado}.` };
    }

    const existing = await betFollowerRepository.getForUser(aid, String(chatId));
    if (existing) {
      if (existing.mode === mode) {
        return {
          ok: true,
          message: `✅ Ya estás siguiendo el ticket #${aid} en este modo (${modeLabels[mode]}).`,
        };
      }
      await betFollowerRepository.removeForUser(aid, String(chatId), existing.mode);
    }

    const currentCount = await betFollowerRepository.countByChat(String(chatId), mode);
    if (currentCount >= maxFollowsPerChat) {
      return {
        ok: false,
        message: `⚠️ Llegaste al máximo de ${maxFollowsPerChat} tickets seguidos en modo ${mode}.`,
      };
    }

    await betFollowerRepository.upsertForUser(aid, String(chatId), mode, null);
    rememberTicket(String(chatId), String(aid));

    const partidoTxt = ticket.partidoExtrado || `partido ${ticket.idPartidoApi ?? '?'}`;
    return {
      ok: true,
      message:
        `✅ Listo, sigo tu ticket #${aid} (${partidoTxt}). Te aviso con ${modeLabels[mode]}.\n\n` +
        `💡 Tip: para cambiar el modo usa "/follow ${aid} outcome" o "/follow ${aid} all".`,
    };
  }

  async function unfollowTicket(chatId, ticketId) {
    const aid = parseInt(ticketId, 10);
    if (!Number.isFinite(aid)) {
      return { ok: false, message: '❌ ticketId inválido.' };
    }
    const existing = await betFollowerRepository.getForUser(aid, String(chatId));
    if (!existing) {
      return { ok: false, message: `❌ No sigues el ticket #${aid}.` };
    }
    await betFollowerRepository.removeAllForUser(aid, String(chatId));
    return { ok: true, message: `✅ Dejé de seguir el ticket #${aid}.` };
  }

  async function listFollowed(chatId) {
    const rows = await betFollowerRepository.listByChat(String(chatId));
    if (rows.length === 0) {
      return {
        ok: true,
        message: '📭 No sigues ningún ticket todavía. Probá: "/follow 555" (con un ticket tuyo).',
      };
    }
    const lines = ['📋 *Tickets que sigues:*\n'];
    for (const sub of rows) {
      const ticket = await betFollowerRepository.getTicketSummary(sub.apuestaId);
      const modeIcon = sub.mode === 'outcome_only' ? '🎯' : '📡';
      const partido = ticket?.partidoExtrado || `ticket #${sub.apuestaId}`;
      lines.push(`${modeIcon} *#${sub.apuestaId}* — ${partido}`);
      lines.push(`   Modo: ${modeLabels[sub.mode] || sub.mode}`);
      if (ticket) lines.push(`   Estado: ${ticket.estado}`);
      lines.push('');
    }
    lines.push('💡 Para dejar de seguir: /unfollow <id>');
    return { ok: true, message: lines.join('\n') };
  }

  async function changeMode(chatId, ticketId, newMode) {
    if (!validModes.includes(newMode)) {
      return { ok: false, message: '� Modo inválido. Usa "all" o "outcome".' };
    }
    const aid = parseInt(ticketId, 10);
    if (!Number.isFinite(aid)) {
      return { ok: false, message: '❌ ticketId inválido.' };
    }
    const existing = await betFollowerRepository.getForUser(aid, String(chatId));
    if (!existing) {
      return { ok: false, message: `❌ No sigues el ticket #${aid}. Primero: /follow ${aid}` };
    }
    if (existing.mode === newMode) {
      return { ok: true, message: `✅ El ticket #${aid} ya estaba en modo "${modeLabels[newMode]}".` };
    }
    await betFollowerRepository.removeForUser(aid, String(chatId), existing.mode);
    await betFollowerRepository.upsertForUser(aid, String(chatId), newMode, null);
    return { ok: true, message: `✅ Ticket #${aid}: modo cambiado a "${modeLabels[newMode]}".` };
  }

  // Parseo de argumentos NL (`{ ticketId, mode }` o `{ ticketId }`).
  function parseIntent(intent) {
    if (!intent) return { ok: false, message: '🤔 No entendí la intención.' };
    return {
      ticketId: intent.ticketId,
      mode: normalizeMode(intent.mode),
    };
  }

  return {
    followTicket,
    unfollowTicket,
    listFollowed,
    changeMode,
    parseIntent,
    normalizeMode,
    MODE_LABELS: modeLabels,
    VALID_MODES: validModes,
    MAX_FOLLOWS_PER_CHAT: maxFollowsPerChat,
    DEFAULT_MODE: defaultMode,
  };
}

module.exports = {
  createFollowTicketUseCase,
  MAX_FOLLOWS_PER_CHAT,
  DEFAULT_MODE,
  MODE_LABELS,
  VALID_MODES,
  normalizeMode,
};
