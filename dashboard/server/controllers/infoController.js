const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));
const images = require(path.join(__dirname, '..', '..', '..', 'services', 'images'));

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const CURRENT_SEASON = parseInt(process.env.SCORES365_SEASON || '25', 10);

async function getCountries(req, res, next) {
  try {
    const countries = await cosmos.queryAll('catalog', {
      query: "SELECT * FROM c WHERE c.entityType = 'countries' ORDER BY c.name ASC",
    });
    res.json(countries.map(c => ({
      id: c.id,
      name: c.name,
      flagUrl: c.id ? images.getCountryFlagUrl(Number(c.id)) : null,
    })));
  } catch (err) {
    next(err);
  }
}

async function getTournamentInfo(req, res, next) {
  try {
    const competitions = await cosmos.queryAll('catalog', {
      query: `SELECT * FROM c WHERE c.entityType = 'competitions' AND c.id = ${MUNDIAL_ID}`,
    });
    if (competitions.length === 0) {
      return res.json({
        id: MUNDIAL_ID,
        name: 'Mundial 2026',
        seasonNum: CURRENT_SEASON,
        format: '48 equipos, 12 grupos, fase eliminatoria',
      });
    }
    const c = competitions[0];
    res.json({
      id: c.id,
      name: c.name,
      nameForURL: c.nameForURL,
      countryId: c.countryId,
      seasonNum: c.currentSeasonNum || CURRENT_SEASON,
      imageVersion: c.imageVersion,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCountries, getTournamentInfo };
