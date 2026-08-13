const log = require('../utils/logger');
const notifier = require('./notifier');
const evaluator = require('./betEvaluator');
const conversationContext = require('./conversationContext');

const bots = new Map();

function registerBot(bot, platform) {
  bots.set(platform || 'telegram', bot);
}

function getBots() {
  return Array.from(bots.entries()).map(([platform, bot]) => ({ platform, bot }));
}

const EVENT_EMOJIS = {
  'goal:scored': '⚽',
  'card:yellow': '🟨',
  'card:red': '🟥',
  'corner': '🚩',
  'match:end': '🏁',
  'half:end': '⏸️',
  'stat:changed': '📊',
};

function formatEventTitle(event) {
  const emoji = EVENT_EMOJIS[event.type] || '📢';
  let title = event.title || event.type;
  if (event.team) title = `${event.team} ${title}`;
  if (event.minute != null) title += ` (min ${event.minute}')`;
  return `${emoji} ${title}`;
}

function formatAllEventsMessage(chatId, event, ticket, evaluation) {
  const lines = [];
  lines.push(formatEventTitle(event));
  if (event.score) lines.push(`📊 Marcador: ${event.score}`);
  if (ticket.partido_extrado || event.gameId) {
    const p = ticket.partido_extrado || `partido ${event.gameId}`;
    lines.push(`🎫 Ticket #${ticket.id} (${p})`);
  }
  return lines.join('\n');
}

function formatOutcomeOnlyMessage(chatId, event, ticket, evaluation) {
  const lines = [];
  const isWinning = evaluation.status === 'winning';
  const isLosing = evaluation.status === 'losing';
  const isPush = evaluation.status === 'push';
  const emoji = isWinning ? '🎉' : (isLosing ? '😔' : '🤝');
  let header = emoji;
  if (isWinning) header += ' ¡GANANDO!';
  else if (isLosing) header += ' Perdiendo...';
  else if (isPush) header += ' Empate (push)';
  else header += ' Pendiente';

  const p = ticket.partido_extrado || `partido ${event.gameId || ticket.id_partido_api}`;
  lines.push(`${header}`);
  lines.push(`🎫 Ticket #${ticket.id} (${p})`);
  if (event.score) lines.push(`📊 Marcador: ${event.score}`);

  const winning = (evaluation.selecciones || []).filter((s) => s.status === 'winning');
  const losing = (evaluation.selecciones || []).filter((s) => s.status === 'losing');
  const pending = (evaluation.selecciones || []).filter((s) => s.status === 'pending');
  if (winning.length) {
    lines.push(`✅ ${winning.length} selección(es) ganadora(s): ${winning.map((s) => s.tipo).join(', ')}`);
  }
  if (losing.length) {
    lines.push(`❌ ${losing.length} fallida(s): ${losing.map((s) => s.tipo).join(', ')}`);
  }
  if (pending.length) {
    lines.push(`⏳ ${pending.length} pendiente(s): ${pending.map((s) => s.tipo).join(', ')}`);
  }
  return lines.join('\n');
}

function shouldNotify(event, mode) {
  if (event.type === 'goal:scored' || event.type === 'card:red' || event.type === 'match:end' || event.type === 'corner') return true;
  if (mode === 'all_events' && (event.type === 'card:yellow' || event.type === 'stat:changed')) return true;
  return false;
}

async function notifyChats(event) {
  const affected = await evaluator.findAffectedChats(event);
  if (affected.length === 0) return { notified: 0 };
  let notified = 0;
  const botEntries = getBots();
  if (botEntries.length === 0) return { notified: 0 };

  for (const { chatId, ticketId, ticket, evaluation, mode } of affected) {
    let message;
    if (mode === 'all_events') {
      message = formatAllEventsMessage(chatId, event, ticket, evaluation);
    } else {
      message = formatOutcomeOnlyMessage(chatId, event, ticket, evaluation);
    }
    let sent = false;
    for (const { bot, platform } of botEntries) {
      try {
        if (platform === 'telegram') {
          await bot.sendMessage(chatId, message);
        } else if (platform === 'whatsapp') {
          await bot.sendMessage(chatId, message);
        }
        sent = true;
        notified++;
        break;
      } catch (e) {
        log.error({ err: e, chatId, platform }, 'telegramNotifier: error sending');
      }
    }
    if (sent) {
      conversationContext.rememberTicket(chatId, ticketId);
    }
  }
  return { notified };
}

function attach() {
  notifier.on('event:any', async (event) => {
    if (!shouldNotify(event, 'all_events')) return;
    try {
      await notifyChats(event);
    } catch (e) {
      log.error({ err: e }, 'telegramNotifier: notifyChats error');
    }
  });
  log.info('telegramNotifier: attached to notifier');
}

function detach() {
  notifier.removeAllListeners('event:any');
}

module.exports = {
  attach,
  detach,
  registerBot,
  formatEventTitle,
  formatAllEventsMessage,
  formatOutcomeOnlyMessage,
  shouldNotify,
  notifyChats,
};