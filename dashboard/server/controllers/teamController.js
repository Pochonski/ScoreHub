const { pool } = require('../../../database/connection');
const images = require('../../../services/images');
const { enrichGame } = require('../utils/mappers');
const { resolveCompetition } = require('../utils/competition');

async function getTeams(req, res, next) {
  try {
    const nationalOnly = req.query.national === 'true';
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    const { rows } = await pool.query(
      'SELECT id, name, data FROM competitors WHERE competition_id = $1',
      [competitionId]
    );
    let data = rows.map(r => {
      const t = r.data;
      return {
        id: r.id,
        name: r.name,
        shortName: t.shortName,
        symbolicName: t.symbolicName,
        countryId: t.countryId,
        imageVersion: t.imageVersion,
        badgeUrl: r.id ? images.getTeamBadgeUrl(r.id, t.imageVersion || 1) : null,
        flagUrl: t.countryId ? images.getCountryFlagUrl(t.countryId) : null,
      };
    });
    if (nationalOnly) {
      data = data.filter(t => {
        const r = rows.find(rr => rr.id === t.id);
        return r?.data?.isNational === true || r?.data?.type === 2;
      });
    }
    data.sort((a, b) => a.name.localeCompare(b.name));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getTeamById(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT id, data FROM competitors WHERE id = $1', [Number(id)]);
    if (!rows.length) return res.status(404).json({ error: 'Equipo no encontrado' });
    const t = rows[0].data;
    res.json({
      id: rows[0].id,
      name: t.name,
      shortName: t.shortName,
      symbolicName: t.symbolicName,
      countryId: t.countryId,
      imageVersion: t.imageVersion,
      badgeUrl: images.getTeamBadgeUrl(rows[0].id, t.imageVersion || 1),
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
    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const { competitionId } = resolved;

    const { rows } = await pool.query(
      'SELECT data FROM games WHERE competition_id = $1 AND (home_competitor_id = $2 OR away_competitor_id = $2) ORDER BY start_time DESC',
      [competitionId, tid]
    );
    const games = rows.map(r => enrichGame(r.data));
    res.json(games);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTeams, getTeamById, getTeamMatches };
