/**
 * src/infrastructure/container.js — Composition root de la arquitectura (Fase 7).
 *
 * Instancia adaptadores + use-cases + command handlers y los registra en el
 * router. Recibe del proceso (telegramBot.js) los colaboradores concretos que
 * aún viven fuera (`mundialista365`, `matchSearch`, `scores365`, `sendMessage`).
 * Se va poblando a medida que la migración strangler mueve cada comando.
 *
 * Auditoría 2026-Q3 Fase 3.4: typedef JSDoc de `ContainerDeps` para documentar
 * el contrato del "wide bag" de dependencias que recibe el composition root.
 * Sigue siendo un objeto plano (no se introduce DI container library), pero
 * ahora el shape es verificable con TypeScript server-side o IDEs.
 */

/**
 * @typedef {Object} ContainerDeps
 * @property {Object} mundialista365 - Handler legacy con getLiveGamesText, getFixtureText, etc.
 * @property {Object} mundialistaStats - Handler legacy con getNoticias, getEquipoIdeal, etc.
 * @property {Object} matchSearch - DB-backed game search service.
 * @property {Object} scores365 - Raw HTTPS client para 365scores.
 * @property {Object} matchHandler - Legacy handler de formato de partidos.
 * @property {Object} cache - MundialCache para staleness.
 * @property {Object} messageHandler - Legacy orchestrator de NL path.
 * @property {Object} userStorage - userStorage.js (alias + clearUserData).
 * @property {Object} pool - pg Pool (para queries directos).
 * @property {(chatId:number|string, text:string, opts?:object) => Promise} sendMessage
 * @property {(chatId:number|string, photo:string|Buffer, opts?:object) => Promise} sendPhoto
 * @property {(chatId:number|string, media:Array, opts?:object) => Promise} sendMediaGroup
 * @property {(teamId:number, version?:number) => string} getTeamBadgeUrl
 * @property {(countryId:number) => string} getCountryFlagUrl
 * @property {(athleteId:number) => string} getAthletePhotoUrl
 * @property {(athleteId:number) => string} getAthleteThumbUrl
 */

const { createRouter } = require('../interface/telegram/router');
const { createScoresGateway } = require('./scores365/scoresGateway');
const { createContentGateway } = require('./content/contentGateway');
const { createMessageHandlerGateway } = require('./nlu/messageHandlerGateway');
const { createCallbackDispatcher } = require('../interface/telegram/callbacks');
const { buildGameKeyboard, buildSingleGameKeyboard } = require('../interface/telegram/presenters/keyboards');
const { createGetLiveMatches } = require('../application/matches/getLiveMatches');
const { createGetFixture } = require('../application/matches/getFixture');
const { createMatchDetailUseCases } = require('../application/matches/matchDetail');
const { createTrendsUseCases } = require('../application/matches/trends');
const { createContentUseCases } = require('../application/content/contentUseCases');
const { TRIGGERS: HELP_TRIGGERS, createHelpCommand } = require('../interface/telegram/commands/help');
const { TRIGGERS: LIVE_TRIGGERS, createLiveCommand } = require('../interface/telegram/commands/live');
const { TRIGGERS: FIXTURE_TRIGGERS, createFixtureCommand } = require('../interface/telegram/commands/fixture');
const { registerMatchDetailCommands } = require('../interface/telegram/commands/matchDetail');
const { registerTrendsCommands } = require('../interface/telegram/commands/trends');
const { registerContentCommands } = require('../interface/telegram/commands/content');
const { registerTeamsCommands } = require('../interface/telegram/commands/teams');
const { registerProfileCommands } = require('../interface/telegram/commands/profile');
const { registerMatchDataCommands } = require('../interface/telegram/commands/matchData');
const { registerPlayerCommands } = require('../interface/telegram/commands/players');

/**
 * Composition root del bot.
 * @param {ContainerDeps} deps
 * @returns {{ router: object, handleCallback: Function }}
 */
function createContainer(deps) {
  const {
    mundialista365, mundialistaStats, matchSearch, scores365, matchHandler, cache,
    messageHandler, userStorage, pool,
    sendMessage, sendPhoto, sendMediaGroup,
    getTeamBadgeUrl, getCountryFlagUrl, getAthletePhotoUrl, getAthleteThumbUrl,
  } = deps;

  // Infraestructura (adaptadores de puertos).
  const scoresGateway = createScoresGateway({ mundialista365, matchSearch, scores365 });
  const contentGateway = createContentGateway({ mundialistaStats });
  const nlu = createMessageHandlerGateway({ messageHandler });

  // Aplicación (use-cases).
  const getLiveMatches = createGetLiveMatches({ scoresGateway });
  const getFixture = createGetFixture({ scoresGateway });
  const matchDetail = createMatchDetailUseCases({ scoresGateway });
  const trends = createTrendsUseCases({ scoresGateway });
  const content = createContentUseCases({ contentGateway, scoresGateway });

  // Interface (router + command handlers migrados).
  const router = createRouter();
  router.register(HELP_TRIGGERS, createHelpCommand({ sendMessage }));
  router.register(LIVE_TRIGGERS, createLiveCommand({ getLiveMatches, sendMessage }));
  router.register(FIXTURE_TRIGGERS, createFixtureCommand({ getFixture, sendMessage }));
  registerMatchDetailCommands(router, { matchDetail, sendMessage });
  registerTrendsCommands(router, { trends, sendMessage });
  registerContentCommands(router, { content, sendMessage, sendPhoto });
  registerTeamsCommands(router, {
    nlu, cache, matchSearch, sendMessage, sendPhoto, sendMediaGroup,
    getTeamBadgeUrl, getCountryFlagUrl, buildGameKeyboard, buildSingleGameKeyboard,
  });
  registerProfileCommands(router, { userStorage, pool, sendMessage });
  registerMatchDataCommands(router, { matchHandler, cache, nlu, sendMessage, buildGameKeyboard });
  registerPlayerCommands(router, {
    cache, scores365, mundialista365,
    getAthletePhotoUrl, getAthleteThumbUrl, getTeamBadgeUrl,
    sendMessage, sendPhoto, sendMediaGroup, buildSingleGameKeyboard,
  });

  // Dispatcher de callbacks de botones inline (reusa el ScoresGateway).
  const handleCallback = createCallbackDispatcher({ scoresGateway, cache, sendMessage });

  return { router, handleCallback };
}

module.exports = { createContainer };
