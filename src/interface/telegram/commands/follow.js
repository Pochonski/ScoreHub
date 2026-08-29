/**
 * src/interface/telegram/commands/follow.js — Comandos /follow /unfollow /misapuestas (Fase 8).
 *
 * Reemplaza los `if (cleaned === '/follow') { ... }` que vivían inline en
 * `telegramBot.js` y los `handleFollowCommand`/`handleUnfollowCommand`/
 * `handleListCommand` del legacy `handlers/followHandler.js`.
 *
 * El router matchea primero; si está registrado acá, este handler corre y
 * nunca cae al god-function `handleCommand`.
 */

const TRIGGERS_FOLLOW = ['/follow'];
// Nota: /dejarseguir es del dominio "teams" (dejar de seguir un equipo), no
// de "bets". El router ya lo registra `registerTeamsCommands`; si lo
// duplicamos acá el container falla con "trigger duplicado".
const TRIGGERS_UNFOLLOW = ['/unfollow'];
const TRIGGERS_LIST = ['/misapuestas', '/siguiendo'];

function registerFollowCommands(router, deps) {
  const { followTicketUseCase, sendMessage } = deps;
  if (!followTicketUseCase) throw new Error('registerFollowCommands: followTicketUseCase required');
  if (!sendMessage) throw new Error('registerFollowCommands: sendMessage required');

  function reply(ctx, result) {
    return sendMessage(ctx.chatId, result.message);
  }

  router.registerPrefix(TRIGGERS_FOLLOW, async (ctx) => {
    const parts = (ctx.arg || '').trim().split(/\s+/);
    const ticketId = parts[0];
    const mode = followTicketUseCase.normalizeMode(parts[1]);
    if (!ticketId) {
      return reply(ctx, { ok: false, message: '❌ Uso: /follow <ticketId> [all|outcome]' });
    }
    if (!/^\d+$/.test(ticketId)) {
      return reply(ctx, { ok: false, message: '❌ ticketId debe ser numérico.' });
    }
    return reply(ctx, await followTicketUseCase.followTicket(ctx.userId, ticketId, mode));
  });

  router.registerPrefix(TRIGGERS_UNFOLLOW, async (ctx) => {
    const ticketId = (ctx.arg || '').trim().split(/\s+/)[0];
    if (!ticketId) return reply(ctx, { ok: false, message: '❌ Uso: /unfollow <ticketId>' });
    if (!/^\d+$/.test(ticketId)) return reply(ctx, { ok: false, message: '❌ ticketId debe ser numérico.' });
    return reply(ctx, await followTicketUseCase.unfollowTicket(ctx.userId, ticketId));
  });

  router.register(TRIGGERS_LIST, async (ctx) => {
    return reply(ctx, await followTicketUseCase.listFollowed(ctx.userId));
  });
}

module.exports = { registerFollowCommands, TRIGGERS_FOLLOW, TRIGGERS_UNFOLLOW, TRIGGERS_LIST };
