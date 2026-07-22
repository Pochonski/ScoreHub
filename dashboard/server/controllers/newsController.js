const { pool } = require('../../../database/connection');
const { resolveCompetition } = require('../utils/competition');

async function getNews(req, res, next) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const scope = req.query.scope || 'competition';

    // Si el cliente pide scope=competition sin id, resolvemos la comp.
    // Para scope=game, el caller debería usar /api/football/news/game/:id.
    let entityId;
    if (scope === 'competition') {
      const resolved = await resolveCompetition(req, res);
      if (!resolved) return;
      entityId = resolved.competitionId;
    } else {
      const resolved = await resolveCompetition(req, res);
      if (!resolved) return;
      entityId = resolved.competitionId;
    }

    const { rows } = await pool.query(
      'SELECT data FROM news WHERE scope = $1 AND entity_id = $2 ORDER BY publish_date DESC NULLS LAST',
      [scope, entityId]
    );
    const allNews = rows.map(r => {
      const n = r.data;
      return {
        id: n.id,
        title: n.title,
        publishDate: n.publishDate,
        image: n.image || null,
        url: n.url,
        sourceId: n.sourceId,
        gameId: n.gameId,
      };
    });

    const offset = (page - 1) * limit;
    res.json(allNews.slice(offset, offset + limit));
  } catch (err) {
    next(err);
  }
}

async function getNewsByGame(req, res, next) {
  try {
    const { id } = req.params;
    const gid = Number(id);
    const { rows: gameRow } = await pool.query(
      'SELECT competition_id FROM games WHERE id = $1',
      [gid]
    );
    const competitionId = gameRow[0]?.competition_id ?? null;

    let rows;
    if (competitionId) {
      const result = await pool.query(
        'SELECT data FROM news WHERE game_id = $1 OR (scope = $2 AND entity_id = $3) ORDER BY publish_date DESC NULLS LAST LIMIT 30',
        [gid, 'competition', competitionId]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        'SELECT data FROM news WHERE game_id = $1 ORDER BY publish_date DESC NULLS LAST LIMIT 30',
        [gid]
      );
      rows = result.rows;
    }
    const data = rows.map(r => {
      const n = r.data;
      return {
        id: n.id,
        title: n.title,
        publishDate: n.publishDate,
        image: n.image || null,
        url: n.url,
        sourceId: n.sourceId,
      };
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getNews, getNewsByGame };
