/**
 * src/infrastructure/container.js — Composition root de la arquitectura (Fase 7).
 *
 * Instancia adaptadores + use-cases + command handlers y los registra en el
 * router. Recibe del proceso (telegramBot.js) los colaboradores concretos que
 * aún viven fuera (`mundialista365`, `matchSearch`, `scores365`, `sendMessage`).
 * Se va poblando a medida que la migración strangler mueve cada comando.
 */

const { createRouter } = require('../interface/telegram/router');
const { createScoresGateway } = require('./scores365/scoresGateway');
const { createContentGateway } = require('./content/contentGateway');
const { createGetLiveMatches } = require('../application/matches/getLiveMatches');
const { createGetFixture } = require('../application/matches/getFixture');
const { createMatchDetailUseCases } = require('../application/matches/matchDetail');
const { createContentUseCases } = require('../application/content/contentUseCases');
const { TRIGGERS: HELP_TRIGGERS, createHelpCommand } = require('../interface/telegram/commands/help');
const { TRIGGERS: LIVE_TRIGGERS, createLiveCommand } = require('../interface/telegram/commands/live');
const { TRIGGERS: FIXTURE_TRIGGERS, createFixtureCommand } = require('../interface/telegram/commands/fixture');
const { registerMatchDetailCommands } = require('../interface/telegram/commands/matchDetail');
const { registerContentCommands } = require('../interface/telegram/commands/content');

function createContainer({ mundialista365, mundialistaStats, matchSearch, scores365, sendMessage, sendPhoto }) {
  // Infraestructura (adaptadores de puertos).
  const scoresGateway = createScoresGateway({ mundialista365, matchSearch, scores365 });
  const contentGateway = createContentGateway({ mundialistaStats });

  // Aplicación (use-cases).
  const getLiveMatches = createGetLiveMatches({ scoresGateway });
  const getFixture = createGetFixture({ scoresGateway });
  const matchDetail = createMatchDetailUseCases({ scoresGateway });
  const content = createContentUseCases({ contentGateway, scoresGateway });

  // Interface (router + command handlers migrados).
  const router = createRouter();
  router.register(HELP_TRIGGERS, createHelpCommand({ sendMessage }));
  router.register(LIVE_TRIGGERS, createLiveCommand({ getLiveMatches, sendMessage }));
  router.register(FIXTURE_TRIGGERS, createFixtureCommand({ getFixture, sendMessage }));
  registerMatchDetailCommands(router, { matchDetail, sendMessage });
  registerContentCommands(router, { content, sendMessage, sendPhoto });

  return { router };
}

module.exports = { createContainer };
