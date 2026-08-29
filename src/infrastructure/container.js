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
const { createScores365UseCases } = require('../application/scores365/useCases');
const { createContentGateway } = require('./content/contentGateway');
// messageHandlerGateway eliminado en Fase 3, useNlu eliminado en T1.5.
// NL flow para texto libre: intentParser → routeIntent use-case.
const { createCallbackDispatcher } = require('../interface/telegram/callbacks');
const { buildGameKeyboard, buildSingleGameKeyboard } = require('../interface/telegram/presenters/keyboards');
const { createGetLiveMatches } = require('../application/matches/getLiveMatches');
const { createGetFixture } = require('../application/matches/getFixture');
const { createMatchDetailUseCases } = require('../application/matches/matchDetail');
const { createTrendsUseCases } = require('../application/matches/trends');
const { createContentUseCases } = require('../application/content/contentUseCases');
const {
  createGetNoticias,
  createGetEquipoIdeal,
  createGetBracket,
  createGetHistorial,
  createGetGoleadores,
} = require('../application/stats/useCases');
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
const { registerFollowCommands } = require('../interface/telegram/commands/follow');
const { createFollowTicketUseCase } = require('../application/bets/followTicket');
const { getCompetitionName, getSeasonLabel } = require('../../services/competitionName');
const { PRIMARY_COMPETITION_ID } = require('../../services/config');

const {
  getMatchRepository,
  getCompetitionRepository,
  getCompetitorRepository,
  getUserRepository,
  getBetFollowerRepository,
  getStatsRepository,
  getBetRepository,
} = require('./persistence');
const { createListMatchesForCompetition } = require('../application/matches/listMatchesForCompetition');
const {
  createGetPartidosHoy,
  createGetPartidosFecha,
  createGetResultadoEquipo,
  createGetProximosEquipo,
  createGetResultadoVS,
} = require('../application/matches/listMatches');
const {
  createGetInfoEquipo,
  createSeguirEquipo,
  createDejarSeguirEquipo,
  createGetEquiposSeguidos,
} = require('../application/teams/useCases');
const {
  createAnalizarEnfrentamiento,
  createAnalizarEquipo,
} = require('../application/betting/useCases');
const { createHandleConversationalMessage } = require('../application/bets/conversationalFollow');
const {
  createProcessBetImage,
  createGetApuestasUsuario,
  createFormatearApuesta,
} = require('../application/bets/processBetImage');
const {
  createGetEstadisticas,
  createGetGoleadores: createGetGoleadoresTeam,
} = require('../application/stats/teamStats');
const { createGetTabla } = require('../application/stats/standings');
const { createRouteIntent } = require('../application/orchestration/routeIntent');
const { createSyncOrchestrator } = require('../application/sync/orchestrator');
const { GeminiNluAdapter } = require('./nlu/GeminiNluAdapter');
const { createGeminiNluRepository } = require('../domain/ports/IGeminiNluRepository');

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

  // Repositorios (Fase 8): disponibles para use-cases y comandos nuevos.
  // Los legacy handlers siguen accediendo a `pool` directo — se migrarán
  // en la Fase 2 del plan, uno a uno, reemplazando `pool.query(...)` por
  // `matchRepository.findByCompetitionAndDate(...)`, etc.
  const matchRepository = getMatchRepository();
  const competitionRepository = getCompetitionRepository();
  const competitorRepository = getCompetitorRepository();
  const userRepository = getUserRepository();
  const betFollowerRepository = getBetFollowerRepository();
  const statsRepository = getStatsRepository();
  const betRepository = getBetRepository();
  const listMatchesForCompetition = createListMatchesForCompetition({ matchRepository });

  // Use-case de seguimiento de tickets (Fase 8, migración de followHandler).
  // `rememberTicket` se inyecta desde el conversationContext legacy para no
  // acoplar el use-case al módulo global; cuando ese módulo se mueva a la
  // nueva arquitectura, se reemplaza la inyección sin tocar el use-case.
  const context = require('../../services/conversationContext');
  const followTicketUseCase = createFollowTicketUseCase({
    betFollowerRepository,
    rememberTicket: (chatId, ticketId) => context.rememberTicket(chatId, ticketId),
  });

  // Use-cases de teams (Fase 8, migración de teamHandler).
  // `dbIsAvailable` se inyecta como callback — los handlers legacy hacían
  // un `testConnection()` cacheado; acá lo hacemos en cada write para no
  // atar la disponibilidad al ciclo de vida del container. Si la DB está
  // caída el callback devuelve false y el use-case devuelve mensaje de error.
  const { testConnection } = require('../../database/connection');
  const dbIsAvailable = async () => {
    try { return !!(await testConnection()); } catch { return false; }
  };
  const teamsUseCases = {
    infoEquipo: createGetInfoEquipo({
      cache,
      getFlag: (name) => require('../../utils/teamContext').getFlag(name),
      getConfederation: (name) => require('../../utils/teamContext').getConfederation(name),
      getRecentForm: (matches, id, n) => require('../../utils/teamContext').getRecentForm(matches, id, n),
    }),
    seguirEquipo: createSeguirEquipo({ userRepository, dbIsAvailable, cache }),
    dejarSeguirEquipo: createDejarSeguirEquipo({ userRepository, dbIsAvailable, cache }),
    getEquiposSeguidos: createGetEquiposSeguidos({ userRepository, dbIsAvailable }),
  };

  // Use-cases de betting (Fase 8, migración de bettingHandler).
  const bettingUseCases = {
    analizarEnfrentamiento: createAnalizarEnfrentamiento({ cache }),
    analizarEquipo: createAnalizarEquipo({ cache }),
  };

  // Use-cases de team stats + standings (Fase 2-9, migración de
  // statsHandler + tableHandler). statsHandler.getGoleadores choca con
  // statsUseCases.goleadores (Fase 2-2 ya migró el de mundialistaStats);
  // acá se exporta como goleadoresTeam para evitar la colisión.
  const { getRecentForm } = require('../../utils/teamContext');
  const { formatMatchLine, formatGroupTable } = require('../../utils/formatters');
  const teamStatsUseCases = {
    estadisticas: createGetEstadisticas({ cache, getRecentForm, formatMatchLine }),
    goleadores: createGetGoleadoresTeam({ cache, getCompetitionName, competitionId: PRIMARY_COMPETITION_ID }),
  };
  const standingsUseCases = {
    tabla: createGetTabla({ cache, getCompetitionName, primaryCompetitionId: PRIMARY_COMPETITION_ID, formatGroupTable }),
  };

  // Use-cases de bet image (Fase 8, migración de betImageHandler).
  // Recibe todos los servicios como deps para no acoplarse al filesystem
  // ni a servicios globales. El container pasa referencias lazy-loaded.
  const ocrService = require('../../services/ocrService');
  const { parseBetText, toJSON, buscarPartidoReal } = require('../../services/betParserService');
  const { guardarImagen, generarNombreArchivo } = require('../../services/imageStorageService');
  const { formatTeamWithFlag } = require('../../services/countryFlagsService');
  const betTrackingEngine = require('../../services/betTrackingEngine');

  const processBetImageUseCase = createProcessBetImage({
    ocrService,
    parseBetText,
    toJSON,
    buscarPartidoReal,
    formatTeamWithFlag,
    guardarImagen,
    generarNombreArchivo,
    betRepository,
    betTrackingEngine,
    testConnection,
  });
  const getApuestasUsuarioUseCase = createGetApuestasUsuario({ betRepository });
  const formatearApuestaUseCase = createFormatearApuesta();

  // Use-cases de conversational (Fase 8, migración de conversationalHandler).
  // Recibe intentParser + context como deps; el threshold de confianza lo
  // maneja el parser internamente, no se duplica acá.
  const intentParser = require('../../services/intentParser');
  const conversationalFollow = createHandleConversationalMessage({
    intentParser,
    followTicketUseCase,
    context,
  });

  // T1.3: scores365UseCases se construye ANTES de matchesList porque
  // resultadoEquipo y resultadoVS lo necesitan como dep (en lugar de
  // mundialista365 directo, que se elimina en T2.1).
  const scores365UseCases = createScores365UseCases({ handler: mundialista365 });

  // Use-cases de matches (Fase 8, migración de matchHandler).
  // Reciben el `cache` (mundialCache) directamente como dependencia — es un
  // servicio con TTL propio que no necesita refactorizarse aún. Cuando se
  // decida abstraerlo como port (Fase 3 o 4) se reemplaza la inyección sin
  // tocar estos use-cases.
  const matchesList = {
    partidosHoy: createGetPartidosHoy({ cache, getCompetitionName }),
    partidosFecha: createGetPartidosFecha({ cache }),
    resultadoEquipo: createGetResultadoEquipo({ cache, scores365UseCases }),
    proximosEquipo: createGetProximosEquipo({ cache }),
    resultadoVS: createGetResultadoVS({ cache, scores365UseCases }),
  };

  // Use-cases de estadísticas (Fase 8, migración de mundialistaStatsHandler).
  // Los servicios de soporte (competitionName, images, matchSearch) siguen
  // viviendo en `services/` — la Fase 3 los consolidará cuando se movan a
  // la nueva arquitectura. Por ahora se inyectan tal cual.
  const statsUseCases = {
    noticias: createGetNoticias({
      statsRepository,
      matchSearch,
      getCompetitionName,
      competitionId: PRIMARY_COMPETITION_ID,
    }),
    equipoIdeal: createGetEquipoIdeal({
      statsRepository,
      getCompetitionName,
      competitionId: PRIMARY_COMPETITION_ID,
    }),
    bracket: createGetBracket({
      statsRepository,
      getCompetitionName,
      competitionId: PRIMARY_COMPETITION_ID,
    }),
    historial: createGetHistorial({
      statsRepository,
      getCompetitionName,
      getSeasonLabel,
      competitionId: PRIMARY_COMPETITION_ID,
    }),
    goleadores: createGetGoleadores({
      statsRepository,
      getCompetitionName,
      getAthletePhotoUrl,
      competitionId: PRIMARY_COMPETITION_ID,
    }),
  };

  // Infraestructura (adaptadores de puertos).
  // Fase 8: scoresGateway ahora recibe scores365UseCases (que envuelve al
  // handler legacy) en lugar de mundialista365 directo. Esto aísla el
  // gateway del handler — cuando se migre la lógica interna, el gateway
  // no cambia.
  const scoresGateway = createScoresGateway({ scores365UseCases, matchSearch, scores365 });
  // Fase 8: contentGateway ahora recibe los use-cases de stats en lugar de
  // el handler legacy. Los use-cases en application/stats/ encapsulan la
  // lógica de mundialistaStatsHandler.js; el handler queda sólo como fachada
  // para callers que lo importen directamente (puede eliminarse cuando
  // ninguno lo referencie).

  const contentGateway = createContentGateway({ statsUseCases });

  // Adaptador NLU (Fase 3): desacopla intentParser del geminiService legacy.
  // El container expone el repo proxy-enforced; el setGeminiNluRepository()
  // hace que intentParser use el adapter en lugar del require() directo.
  const geminiService = require('../../services/geminiService');
  const geminiNluRepository = createGeminiNluRepository(new GeminiNluAdapter({ geminiService }));
  const intentParserModule = require('../../services/intentParser');
  intentParserModule.setGeminiNluRepository(geminiNluRepository);

  // Sync orchestrator (Fase 4): factory que recibe clock + runIdGenerator
  // + logger por DI. Reemplaza al `syncAll()` legacy de syncService.js para
  // callers nuevos; el legacy queda como fachada para el scheduler actual.
  const syncOrchestrator = createSyncOrchestrator();

  // Use-cases consolidados para callers externos (commands de Telegram).
  // T1.4: teams.js y matchData.js reciben este objeto en lugar de `nlu`,
  // y llaman useCases.<dominio>.<función> directo. Reemplaza los 10
  // nlu.delegate() del legacy.
  const useCasesObj = {
    matches: matchesList,
    teams: teamsUseCases,
    betting: bettingUseCases,
    teamStats: teamStatsUseCases,
    standings: standingsUseCases,
  };

  // Use-cases de routeIntent (Fase 2-9, orquestador de intents NL).
  // Reemplaza handlers/messageHandler.js. Recibe safeReply y saveHistory
  // como deps para abstraer WhatsApp y storage.
  const { INTENTOS } = require('../../utils/constants');
  const routeIntent = createRouteIntent({
    useCases: useCasesObj,
    INTENTOS,
    safeReply: (msg, text) => Promise.resolve(msg.reply(text)).catch((e) => {
      // Replicar comportamiento legacy: ignorar errores de desconexión.
      if (!e.message?.match(/Execution context|Protocol error|target closed/)) {
        throw e;
      }
    }),
    saveHistory: async (userId, text, tipo, response) => {
      try {
        await pool.query(
          'INSERT INTO historial_consultas (id_usuario, consulta, tipo, respuesta, fecha) VALUES ($1, $2, $3, $4, NOW())',
          [String(userId), text, tipo || 'comando', response || '']
        );
      } catch (e) { /* noop — legacy ignoraba */ }
    },
  });

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
    useCases: useCasesObj, cache, matchSearch, sendMessage, sendPhoto, sendMediaGroup,
    getTeamBadgeUrl, getCountryFlagUrl, buildGameKeyboard, buildSingleGameKeyboard,
  });
  registerProfileCommands(router, { userStorage, pool, sendMessage });
  registerMatchDataCommands(router, { matchesList, cache, useCases: useCasesObj, sendMessage, buildGameKeyboard });
  registerPlayerCommands(router, {
    cache, scores365, mundialista365,
    getAthletePhotoUrl, getAthleteThumbUrl, getTeamBadgeUrl,
    sendMessage, sendPhoto, sendMediaGroup, buildSingleGameKeyboard,
  });
  registerFollowCommands(router, { followTicketUseCase, sendMessage });

  // Dispatcher de callbacks de botones inline (reusa el ScoresGateway).
  const handleCallback = createCallbackDispatcher({ scoresGateway, cache, sendMessage });

    return {
      router,
      handleCallback,
      // Fase 8: repositorios expuestos para migración incremental de Fase 2.
      repositories: {
        match: matchRepository,
        competition: competitionRepository,
        competitor: competitorRepository,
        user: userRepository,
        betFollower: betFollowerRepository,
        stats: statsRepository,
        bet: betRepository,
        geminiNlu: geminiNluRepository,
      },
      useCases: {
        listMatchesForCompetition,
        followTicket: followTicketUseCase,
        stats: statsUseCases,
        matches: matchesList,
        teams: teamsUseCases,
        betting: bettingUseCases,
        conversationalFollow,
        betImage: {
          process: processBetImageUseCase,
          listByUser: getApuestasUsuarioUseCase,
          formatear: formatearApuestaUseCase,
        },
        teamStats: teamStatsUseCases,
        standings: standingsUseCases,
        routeIntent,
        sync: syncOrchestrator,
      },
    };
}

module.exports = { createContainer };
