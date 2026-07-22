const { Router } = require('express');
const matchController = require('../controllers/matchController');
const standingController = require('../controllers/standingController');
const historyController = require('../controllers/historyController');
const statsController = require('../controllers/statsController');
const trendController = require('../controllers/trendController');
const newsController = require('../controllers/newsController');
const athleteController = require('../controllers/athleteController');
const teamController = require('../controllers/teamController');
const infoController = require('../controllers/infoController');

const router = Router();

// Match routes
router.get('/matches', matchController.getMatches);
router.get('/matches/live', matchController.getLiveMatches);
router.get('/matches/featured', matchController.getFeaturedMatch);
router.get('/matches/:id', matchController.getMatchById);
router.get('/matches/:id/stats', matchController.getMatchStats);
router.get('/matches/:id/h2h', matchController.getMatchH2h);
router.get('/matches/:id/lineups', matchController.getMatchLineups);
router.get('/matches/:id/pre-stats', matchController.getMatchPreStats);
router.get('/matches/:id/tips', matchController.getMatchTips);
router.get('/matches/:id/trends', matchController.getMatchTrends);
router.get('/matches/:id/predictions', matchController.getMatchPredictions);
router.get('/matches/:id/timeline', matchController.getMatchTimeline);
router.get('/matches/:id/suggestions', matchController.getMatchSuggestions);

// Standing routes
router.get('/standings', standingController.getStandings);
router.get('/brackets', standingController.getBrackets);

// History routes
router.get('/history/stats', historyController.getHistoryStats);
router.get('/history/:seasonNum/match-stats', historyController.getHistoryMatchStats);
router.get('/history/:seasonNum/match-overview', historyController.getHistoryMatchOverview);
router.get('/history/:seasonNum/description', historyController.getHistoryDescription);
router.get('/history/:seasonNum', historyController.getHistoryBySeason);
router.get('/history', historyController.getHistory);

// Stats routes
router.get('/stats/scorers', statsController.getTopScorers);
router.get('/stats/assists', statsController.getTopAssists);
router.get('/stats/ratings', statsController.getTopRatings);
router.get('/stats/team-of-week', statsController.getTeamOfWeek);

// Trends route
router.get('/trends', trendController.getCompetitionTrends);

// News routes
router.get('/news', newsController.getNews);
router.get('/news/game/:id', newsController.getNewsByGame);

// Athlete routes
router.get('/athletes', athleteController.searchAthletes);
router.get('/athletes/:id', athleteController.getAthleteById);
router.get('/athletes/:id/career', athleteController.getAthleteCareer);
router.get('/athletes/:id/trophies', athleteController.getAthleteTrophies);
router.get('/athletes/:id/transfers', athleteController.getAthleteTransfers);

// Team routes
router.get('/teams', teamController.getTeams);
router.get('/teams/:id', teamController.getTeamById);
router.get('/teams/:id/matches', teamController.getTeamMatches);

// Info routes
router.get('/countries', infoController.getCountries);
router.get('/tournament-info', infoController.getTournamentInfo);

// Competition catalog (multi-comp)
router.get('/competitions/featured', infoController.getFeaturedCompetitions);
router.get('/competitions/:id/seasons', infoController.getCompetitionSeasons);
router.get('/competitions/:id', infoController.getCompetitionDetail);
router.get('/competitions', infoController.getCompetitions);

module.exports = router;
