const path = require('path');
const cosmos = require(path.join(__dirname, '..', '..', '..', 'database', 'cosmos'));

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);
const COMPETITION_PK = String(MUNDIAL_ID);

async function getNews(req, res, next) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * limit;
    const scope = req.query.scope || 'comp';

    const news = await cosmos.queryAll('news', {
      query: 'SELECT c.id, c.title, c.publishDate, c.image, c.url, c.sourceId, c.gameId FROM c WHERE c.scope = @s AND c.competitionId = @compId ORDER BY c.publishDate DESC OFFSET @offset LIMIT @limit',
      parameters: [
        { name: '@s', value: scope },
        { name: '@compId', value: COMPETITION_PK },
        { name: '@offset', value: offset },
        { name: '@limit', value: limit },
      ],
    });
    res.json(news.map(n => ({
      id: n.id,
      title: n.title,
      publishDate: n.publishDate,
      image: n.image || null,
      url: n.url,
      sourceId: n.sourceId,
      gameId: n.gameId,
    })));
  } catch (err) {
    next(err);
  }
}

async function getNewsByGame(req, res, next) {
  try {
    const { id } = req.params;

    const news = await cosmos.queryAll('news', {
      query: `SELECT * FROM c WHERE c.scope = 'game' AND c.gameId = ${Number(id)} ORDER BY c.publishDate DESC`,
    });
    res.json(news.map(n => ({
      id: n.id,
      title: n.title,
      publishDate: n.publishDate,
      image: n.image || null,
      url: n.url,
      sourceId: n.sourceId,
    })));
  } catch (err) {
    next(err);
  }
}

module.exports = { getNews, getNewsByGame };
