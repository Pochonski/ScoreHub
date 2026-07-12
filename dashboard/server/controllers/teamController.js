const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));
const { enrichGame } = require('../utils/mappers');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);

async function getTeams(req, res, next) {
  try {
    const nationalOnly = req.query.national === 'true';
    let query = `SELECT * FROM c WHERE c.entityType = 'competitors'`;

    if (nationalOnly) {
      query += ` AND c.isNational = true`;
    }
    query += ' ORDER BY c.name ASC';

    const teams = await cosmos.queryAll('catalog', { query });
    res.json(teams.map(t => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion,
      badgeUrl: t.id ? images.getTeamBadgeUrl(t.id, t.imageVersion || 1) : null,
      flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
    })));
  } catch (err) {
    next(err);
  }
}

async function getTeamById(req, res, next) {
  try {
    const { id } = req.params;
    const tid = Number(id);
    const teams = await cosmos.queryAll('catalog', {
      query: `SELECT * FROM c WHERE c.entityType = 'competitors' AND c.id = ${tid}`,
    });
    if (teams.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });

    const t = teams[0];
    res.json({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion,
      badgeUrl: t.id ? images.getTeamBadgeUrl(t.id, t.imageVersion || 1) : null,
      flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
    });
  } catch (err) {
    next(err);
  }
}

async function getTeamMatches(req, res, next) {
  try {
    const { id } = req.params;
    const tid = Number(id);
    const games = await cosmos.queryAll('games', {
      query: `SELECT * FROM c WHERE c.competitionId = ${MUNDIAL_ID} AND (c.homeCompetitor.id = ${tid} OR c.awayCompetitor.id = ${tid}) ORDER BY c.startTime DESC`,
    });
    res.json(games.map(enrichGame));
  } catch (err) {
    next(err);
  }
}

module.exports = { getTeams, getTeamById, getTeamMatches };
