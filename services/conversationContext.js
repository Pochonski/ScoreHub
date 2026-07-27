const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '..', 'database', '.conversation-context.json');
const TMP_FILE = STORE_FILE + '.tmp';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TICKETS = 10;

let store = null;
let dirty = false;
let saveTimer = null;

function loadStore() {
  if (store) return store;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const txt = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(txt);
      store = {};
      for (const [chatId, ctx] of Object.entries(parsed)) {
        if (ctx && typeof ctx === 'object' && ctx.lastInteraction) {
          const age = Date.now() - new Date(ctx.lastInteraction).getTime();
          if (age < TTL_MS) {
            store[chatId] = ctx;
          }
        }
      }
    } else {
      store = {};
    }
  } catch (_) {
    store = {};
  }
  return store;
}

function scheduleSave() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!dirty) return;
    try {
      fs.writeFileSync(TMP_FILE, JSON.stringify(store, null, 2));
      try { fs.unlinkSync(STORE_FILE); } catch (e) { /* temp file may not exist */ }
      fs.renameSync(TMP_FILE, STORE_FILE);
      dirty = false;
    } catch (e) {
      console.error('[conversationContext] save failed:', e.message?.split('\n')[0]);
    }
  }, 5000);
}

function get(chatId) {
  loadStore();
  return store[chatId] || { recentTickets: [], recentGames: [], defaultMode: 'all_events', lastInteraction: 0 };
}

function set(chatId, updates) {
  loadStore();
  store[chatId] = {
    recentTickets: updates.recentTickets ?? store[chatId]?.recentTickets ?? [],
    recentGames: updates.recentGames ?? store[chatId]?.recentGames ?? [],
    defaultMode: updates.defaultMode ?? store[chatId]?.defaultMode ?? 'all_events',
    lastInteraction: Date.now(),
    lastIntent: updates.lastIntent ?? store[chatId]?.lastIntent,
  };
  scheduleSave();
  return store[chatId];
}

function rememberTicket(chatId, ticketId) {
  loadStore();
  if (!store[chatId]) {
    store[chatId] = { recentTickets: [], recentGames: [], defaultMode: 'all_events', lastInteraction: 0 };
  }
  const ctx = store[chatId];
  if (!ctx.recentTickets) ctx.recentTickets = [];
  if (!ctx.recentTickets.includes(ticketId)) {
    ctx.recentTickets.unshift(ticketId);
    if (ctx.recentTickets.length > MAX_TICKETS) ctx.recentTickets = ctx.recentTickets.slice(0, MAX_TICKETS);
  }
  ctx.lastInteraction = Date.now();
  scheduleSave();
  return ctx;
}

function rememberGame(chatId, gameId) {
  loadStore();
  if (!store[chatId]) {
    store[chatId] = { recentTickets: [], recentGames: [], defaultMode: 'all_events', lastInteraction: 0 };
  }
  const ctx = store[chatId];
  if (!ctx.recentGames) ctx.recentGames = [];
  if (!ctx.recentGames.includes(gameId)) {
    ctx.recentGames.unshift(gameId);
    if (ctx.recentGames.length > MAX_TICKETS) ctx.recentGames = ctx.recentGames.slice(0, MAX_TICKETS);
  }
  ctx.lastInteraction = Date.now();
  scheduleSave();
  return ctx;
}

function getDefaultMode(chatId) {
  const ctx = get(chatId);
  return ctx.defaultMode || 'all_events';
}

function setDefaultMode(chatId, mode) {
  if (mode !== 'all_events' && mode !== 'outcome_only') {
    mode = 'all_events';
  }
  return set(chatId, { defaultMode: mode });
}

function getRecentTickets(chatId) {
  return get(chatId).recentTickets || [];
}

function getRecentGames(chatId) {
  return get(chatId).recentGames || [];
}

function summarize(chatId) {
  const ctx = get(chatId);
  return {
    recentTickets: (ctx.recentTickets || []).slice(0, 3),
    recentGames: (ctx.recentGames || []).slice(0, 3),
    defaultMode: ctx.defaultMode || 'all_events',
    lastInteraction: ctx.lastInteraction ? new Date(ctx.lastInteraction).toISOString() : null,
  };
}

function flushSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (dirty && store) {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
      dirty = false;
    } catch (e) { console.error('[conversationContext] flush failed:', e.message); }
  }
}

module.exports = {
  get, set,
  rememberTicket, rememberGame,
  getDefaultMode, setDefaultMode,
  getRecentTickets, getRecentGames,
  summarize, flushSync,
  STORE_FILE,
};