/**
 * src/interface/telegram/presenters/keyboards.js — Teclados inline (Fase 7, Fase 2).
 *
 * Presentación pura: construye los `inline_keyboard` de Telegram a partir de
 * partidos. Movido verbatim desde telegramBot.js; lo usan tanto los command
 * handlers migrados como las ramas legacy que aún quedan en `handleCommand`.
 */

const ACTION_LABELS = {
  tip: '🎯 Tip',
  trends: '📊 Trends',
  odds: '🎲 Odds',
  h2h: '🤝 H2H',
  previa: '📊 Previa',
  lineup: '📋 Alineación',
  stats: '📈 Stats Vivo',
};

/**
 * Construye teclado inline para una lista de partidos.
 * @param {Array} games
 * @param {string[]} actions - acciones por partido (tip, trends, odds, h2h, previa, lineup, stats)
 */
function buildGameKeyboard(games, actions = ['tip', 'trends', 'odds']) {
  const keyboard = [];
  for (const m of games) {
    const gameId = m.id;
    const home = (m.homeCompetitor?.name || m.homeTeam || '???').substring(0, 3).toUpperCase();
    const away = (m.awayCompetitor?.name || m.awayTeam || '???').substring(0, 3).toUpperCase();
    const row = actions.map((a) => ({
      text: `${ACTION_LABELS[a] || a} ${home}-${away}`,
      callback_data: `${a}_${gameId}`,
    }));
    keyboard.push(row);
  }
  return keyboard;
}

/**
 * Construye teclado inline para un solo partido (una fila).
 * @param {string|number} gameId
 * @param {string[]} actions
 */
function buildSingleGameKeyboard(gameId, actions = ['odds']) {
  const row = actions.map((a) => ({
    text: ACTION_LABELS[a] || a,
    callback_data: `${a}_${gameId}`,
  }));
  return [row];
}

module.exports = { ACTION_LABELS, buildGameKeyboard, buildSingleGameKeyboard };
