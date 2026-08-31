/**
 * src/domain/ports/ICache.js — Puerto de cache de 365scores (Fase 8+).
 *
 * Abstrae el read-through cache (services/mundialCache.js) que cachea
 * resultados de 365scores por TTL. Los use-cases (matches, teams, stats)
 * reciben este port por DI; el adapter (CacheAdapter en
 * infrastructure/cache/) es el boundary.
 *
 * Siete métodos públicos + tres low-level (get/set/has) para los callers
 * que necesitan acceso al store interno. Tests pueden inyectar
 * InMemoryCacheAdapter sin tocar el filesystem ni el TTL.
 *
 * @typedef {Object} CacheEntry
 * @property {*} value
 * @property {number} ts    timestamp de cuando se cacheó
 *
 * @typedef {Object} ICache
 * @property {(key:string) => CacheEntry|undefined} get
 * @property {(key:string, value:*) => void} set
 * @property {(key:string) => boolean} has
 * @property {() => void} clear
 * @property {(key:string) => void} clearKey
 * @property {(opts?:{date?:string, onlyMajorGames?:boolean, range?:number}) => Promise<Array>} getWorldCupGames
 * @property {() => Promise<Array>} getWorldCupStandings
 * @property {(teamId:number) => Promise<Array>} getRecentWorldCupMatchesByTeam
 * @property {(gameId:number) => Promise<Array>} getMatchStats
 * @property {(teamName:string) => Promise<Object|undefined>} getTeamByName
 * @property {(compIdA:number, compIdB:number) => Promise<Object|null>} findGameByCompetitors
 * @property {() => Promise<Object|undefined>} getTournamentTop
 */

// Solo los métodos que `services/mundialCache.js` expone (los de alto
// nivel; los internos `get/set/has/clear` operan sobre el Map privado
// y no son parte del contrato del port).
const REQUIRED_METHODS = [
  'getWorldCupGames',
  'getWorldCupStandings',
  'getRecentWorldCupMatchesByTeam',
  'getMatchStats',
  'getTeamByName',
  'findGameByCompetitors',
  'getTournamentTop',
  'getGameById',
];

function createCache(adapter = {}) {
  if (!adapter) {
    throw new Error('createCache: adapter must be an object');
  }
  const handler = new Proxy(adapter, {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `cache.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  });
  return {
    getWorldCupGames: (opts) => handler.getWorldCupGames(opts),
    getWorldCupStandings: () => handler.getWorldCupStandings(),
    getRecentWorldCupMatchesByTeam: (teamId) => handler.getRecentWorldCupMatchesByTeam(teamId),
    getMatchStats: (gameId) => handler.getMatchStats(gameId),
    getTeamByName: (name) => handler.getTeamByName(name),
    findGameByCompetitors: (compIdA, compIdB) => handler.findGameByCompetitors(compIdA, compIdB),
    getTournamentTop: () => handler.getTournamentTop(),
    getGameById: (gameId) => handler.getGameById(gameId),
  };
}

module.exports = { createCache, REQUIRED_METHODS };
