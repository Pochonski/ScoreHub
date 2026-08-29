/**
 * src/domain/ports/IStatsRepository.js — Puerto de repositorio de estadísticas (Fase 8).
 *
 * Tablas: `news`, `team_of_week`, `brackets`, `competition_history`,
 * `tournament_stats`. Todas almacenan payloads JSONB opacos (`data`),
 * sincronizados por syncService.js desde 365scores.
 *
 * El repositorio devuelve los payloads crudos; el formateo a texto de
 * Telegram vive en los presenters de application/stats/. Esto evita acoplar
 * el port a un cliente específico (Telegram) y permite reusar la data en
 * otros canales (dashboard, REST API).
 *
 * @typedef {Object} NewsDTO
 * @property {Object} data              // payload crudo de la noticia
 *
 * @typedef {Object} TeamOfWeekDTO
 * @property {number} competitionId
 * @property {Object} data              // { teamOfWeek: { formation, lineup: { members } } } o { lineup: { ... } }
 *
 * @typedef {Object} BracketDTO
 * @property {number} competitionId
 * @property {Object} data              // { stages: [...] }
 *
 * @typedef {Object} CompetitionHistoryDTO
 * @property {number} competitionId
 * @property {number} seasonNum         // parseado de data->>'seasonNum'
 * @property {Object} data              // group: { participants, games }
 *
 * @typedef {Object} TournamentStatsDTO
 * @property {number} competitionId
 * @property {Object} data              // { stats: [...] } o { stats: { ... } }
 *
 * @typedef {Object} IStatsRepository
 * @property {(competitionId:number, scope:string, limit:number) => Promise<NewsDTO[]>} getNews
 * @property {(competitionId:number) => Promise<TeamOfWeekDTO|null>} getTeamOfWeek
 * @property {(competitionId:number) => Promise<BracketDTO|null>} getBracket
 * @property {(competitionId:number) => Promise<CompetitionHistoryDTO[]>} getCompetitionHistory
 * @property {(competitionId:number) => Promise<TournamentStatsDTO|null>} getLatestTournamentStats
 */

const REQUIRED_METHODS = [
  'getNews',
  'getTeamOfWeek',
  'getBracket',
  'getCompetitionHistory',
  'getLatestTournamentStats',
];

function createStatsRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createStatsRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `statsRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createStatsRepository, REQUIRED_METHODS };
