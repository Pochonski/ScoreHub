/**
 * src/infrastructure/persistence/index.js — Composition root de repositorios.
 *
 * Construye los adapters concretos y los envuelve con sus factories-port.
 * El container lo consume y los pasa a use-cases vía inyección de deps.
 *
 * Los repos viven como singletons lazy (se construyen al primer acceso) para
 * no forzar la conexión a DB en arranque — Supabase/pg config pueden no estar
 * listos en import-time durante tests.
 */

const { PgMatchRepository } = require('./PgMatchRepository');
const { PgCompetitionRepository } = require('./PgCompetitionRepository');
const { PgCompetitorRepository } = require('./PgCompetitorRepository');
const { PgUserRepository } = require('./PgUserRepository');
const { PgBetFollowerRepository } = require('./PgBetFollowerRepository');
const { PgStatsRepository } = require('./PgStatsRepository');
const { PgBetRepository } = require('./PgBetRepository');

const { createMatchRepository } = require('../../domain/ports/IMatchRepository');
const { createCompetitionRepository } = require('../../domain/ports/ICompetitionRepository');
const { createCompetitorRepository } = require('../../domain/ports/ICompetitorRepository');
const { createUserRepository } = require('../../domain/ports/IUserRepository');
const { createBetFollowerRepository } = require('../../domain/ports/IBetFollowerRepository');
const { createStatsRepository } = require('../../domain/ports/IStatsRepository');
const { createBetRepository } = require('../../domain/ports/IBetRepository');

const logger = require('../../../utils/logger');

let _matchRepo = null;
let _competitionRepo = null;
let _competitorRepo = null;
let _userRepo = null;
let _betFollowerRepo = null;
let _statsRepo = null;
let _betRepo = null;

function getMatchRepository() {
  if (!_matchRepo) {
    _matchRepo = createMatchRepository(new PgMatchRepository({ logger }));
  }
  return _matchRepo;
}

function getCompetitionRepository() {
  if (!_competitionRepo) {
    _competitionRepo = createCompetitionRepository(new PgCompetitionRepository({ logger }));
  }
  return _competitionRepo;
}

function getCompetitorRepository() {
  if (!_competitorRepo) {
    _competitorRepo = createCompetitorRepository(new PgCompetitorRepository({ logger }));
  }
  return _competitorRepo;
}

function getUserRepository() {
  if (!_userRepo) {
    _userRepo = createUserRepository(new PgUserRepository({ logger }));
  }
  return _userRepo;
}

function getBetFollowerRepository() {
  if (!_betFollowerRepo) {
    _betFollowerRepo = createBetFollowerRepository(new PgBetFollowerRepository({ logger }));
  }
  return _betFollowerRepo;
}

function getStatsRepository() {
  if (!_statsRepo) {
    _statsRepo = createStatsRepository(new PgStatsRepository({ logger }));
  }
  return _statsRepo;
}

function getBetRepository() {
  if (!_betRepo) {
    _betRepo = createBetRepository(new PgBetRepository({ logger }));
  }
  return _betRepo;
}

// Reset hook — solo para tests; nunca invocar desde código de aplicación.
function _resetForTesting() {
  _matchRepo = null;
  _competitionRepo = null;
  _competitorRepo = null;
  _userRepo = null;
  _betFollowerRepo = null;
  _statsRepo = null;
  _betRepo = null;
}

module.exports = {
  getMatchRepository,
  getCompetitionRepository,
  getCompetitorRepository,
  getUserRepository,
  getBetFollowerRepository,
  getStatsRepository,
  getBetRepository,
  _resetForTesting,
};
