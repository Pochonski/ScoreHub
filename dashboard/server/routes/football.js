const { Router } = require('express');
const matchController = require('../controllers/matchController');
const standingController = require('../controllers/standingController');
const historyController = require('../controllers/historyController');
const statsController = require('../controllers/statsController');
const trendController = require('../controllers/trendController');
const trendDetailController = require('../controllers/trendDetailController');
const newsController = require('../controllers/newsController');
const athleteController = require('../controllers/athleteController');
const teamController = require('../controllers/teamController');
const teamEnhancementsController = require('../controllers/teamEnhancementsController');
const transfersController = require('../controllers/transfersController');
const infoController = require('../controllers/infoController');

const router = Router();

/**
 * Edge-cache para respuestas GET públicas (Fase egress-2026b).
 *
 * Todos estos endpoints devuelven lo mismo para todos los usuarios, así que
 * `s-maxage` deja que el CDN de Vercel sirva los polls repetidos del
 * dashboard sin tocar Supabase: N usuarios polleando cada 30s pasan de
 * N queries/30s a ~1 query por TTL. Sin esto, el polling es el mayor
 * contribuyente al egress (pausa del proyecto por límite en 2026-09).
 *
 * El browser NO cachea (`max-age=0`) para que el dashboard siga viendo
 * datos frescos al navegar; solo el edge comparte la respuesta.
 */
function edge(ttlSeconds, swrSeconds) {
  const swr = swrSeconds ?? ttlSeconds * 2;
  return (req, res, next) => {
    res.set('Cache-Control', `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${swr}`);
    next();
  };
}

// Match routes
router.get('/matches', edge(30), matchController.getMatches);
router.get('/matches/live', edge(20), matchController.getLiveMatches);
router.get('/matches/featured', edge(20), matchController.getFeaturedMatch);
router.get('/matches/:id', edge(60), matchController.getMatchById);
router.get('/matches/:id/stats', edge(60), matchController.getMatchStats);
router.get('/matches/:id/h2h', edge(300), matchController.getMatchH2h);
router.get('/matches/:id/lineups', edge(300), matchController.getMatchLineups);
router.get('/matches/:id/pre-stats', edge(300), matchController.getMatchPreStats);
router.get('/matches/:id/tips', edge(120), matchController.getMatchTips);
router.get('/matches/:id/trends', edge(120), matchController.getMatchTrends);
router.get('/matches/:id/predictions', edge(120), matchController.getMatchPredictions);
router.get('/matches/:id/timeline', edge(30), matchController.getMatchTimeline);
router.get('/matches/:id/suggestions', edge(300), matchController.getMatchSuggestions);
router.get('/matches/:id/preview', edge(120), matchController.getMatchPreview);

// Standing routes
router.get('/standings/seasons', edge(600), standingController.getStandingsSeasons);
router.get('/standings', edge(120), standingController.getStandings);
router.get('/brackets', edge(300), standingController.getBrackets);

// History routes (casi estático)
router.get('/history/stats', edge(3600), historyController.getHistoryStats);
router.get('/history/:seasonNum/match-stats', edge(3600), historyController.getHistoryMatchStats);
router.get('/history/:seasonNum/match-overview', edge(3600), historyController.getHistoryMatchOverview);
router.get('/history/:seasonNum/description', edge(3600), historyController.getHistoryDescription);
router.get('/history/:seasonNum', edge(3600), historyController.getHistoryBySeason);
router.get('/history', edge(3600), historyController.getHistory);

// Stats routes
router.get('/stats/scorers', edge(300), statsController.getTopScorers);
router.get('/stats/assists', edge(300), statsController.getTopAssists);
router.get('/stats/ratings', edge(300), statsController.getTopRatings);
router.get('/stats/team-of-week', edge(300), statsController.getTeamOfWeek);

// Trends route
router.get('/trends', edge(300), trendController.getCompetitionTrends);
router.get('/trends/details', edge(300), trendDetailController.getTrendDetails);

// News routes
router.get('/news', edge(120), newsController.getNews);
router.get('/news/game/:id', edge(120), newsController.getNewsByGame);

// Athlete routes
router.get('/athletes', edge(300), athleteController.searchAthletes);
router.get('/athletes/:id', edge(3600), athleteController.getAthleteById);
router.get('/athletes/:id/career', edge(3600), athleteController.getAthleteCareer);
router.get('/athletes/:id/trophies', edge(3600), athleteController.getAthleteTrophies);
router.get('/athletes/:id/transfers', edge(3600), athleteController.getAthleteTransfers);

// Team routes (search ANTES de :id o "search" cae en el param)
router.get('/teams', edge(600), teamController.getTeams);
router.get('/teams/search', edge(300), teamController.searchTeams);
router.get('/teams/:id', edge(300), teamController.getTeamById);
router.get('/teams/:id/info', edge(300), teamEnhancementsController.getTeamInfo);
router.get('/teams/:id/recent-form', edge(120), teamEnhancementsController.getTeamRecentForm);
router.get('/teams/:id/upcoming', edge(120), teamEnhancementsController.getTeamUpcoming);
router.get('/teams/:id/recent-matches', edge(120), teamEnhancementsController.getTeamRecentMatches);
router.get('/teams/:id/matches', edge(120), teamController.getTeamMatches);

// Info routes
router.get('/countries', edge(86400), infoController.getCountries);
router.get('/tournament-info', edge(600), infoController.getTournamentInfo);

// Competition catalog (multi-comp)
router.get('/competitions/featured', edge(600), infoController.getFeaturedCompetitions);
router.get('/competitions/:id/transfers/summary', edge(600), transfersController.getCompetitionTransfersSummary);
router.get('/competitions/:id/transfers', edge(600), transfersController.getCompetitionTransfers);
router.get('/competitions/:id/insights', edge(300), infoController.getCompetitionInsights);
router.get('/competitions/:id/seasons', edge(600), infoController.getCompetitionSeasons);
router.get('/competitions/:id', edge(300), infoController.getCompetitionDetail);
router.get('/competitions', edge(600), infoController.getCompetitions);

// Suggestions (cached per competition)
router.get('/suggestions', edge(600), transfersController.getGameSuggestions);

module.exports = router;
