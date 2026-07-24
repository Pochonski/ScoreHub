const db = require('../../../database/db');
const { resolveCompetition } = require('../utils/competition');

async function getNews(req, res, next) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const scope = req.query.scope || 'competition';

    const resolved = await resolveCompetition(req, res);
    if (!resolved) return;
    const entityId = resolved.competitionId;

    const { data, error } = await db.query('news', {
      select: 'data',
      eq: { scope, entity_id: entityId },
      order: { column: 'publish_date', asc: false },
      limit: 100,
    });
    if (error) throw error;
    const allNews = (data || []).map(r => {
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
    const { data: gameData, error: gameErr } = await db.query('games', {
      select: 'competition_id',
      eq: { id: gid },
      maybeSingle: true,
    });
    if (gameErr) throw gameErr;
    const competitionId = gameData?.competition_id ?? null;

    let rows;
    if (competitionId) {
      const result = await db.execAdvanced(
        `SELECT data FROM news
          WHERE game_id = $1 OR (scope = $2 AND entity_id = $3)
          ORDER BY publish_date DESC NULLS LAST LIMIT 30`,
        [gid, 'competition', competitionId]
      );
      rows = result;
    } else {
      const { data, error } = await db.query('news', {
        select: 'data',
        eq: { game_id: gid },
        order: { column: 'publish_date', asc: false },
        limit: 30,
      });
      if (error) throw error;
      rows = data || [];
    }
    const mapped = rows.map(r => {
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
    res.json(mapped);
  } catch (err) {
    next(err);
  }
}

module.exports = { getNews, getNewsByGame };
