'use strict';

/**
 * seoController — sitemap.xml dinámico + metas OG para preview bots.
 *
 * La app es SPA: los crawlers de mensajería (WhatsApp/Telegram/Twitter)
 * no ejecutan JS y verían el shell vacío. Este módulo:
 *  - GET /sitemap.xml: competiciones activas + partidos recientes (slim).
 *  - botMeta middleware: para UAs de preview, responde HTML mínimo con
 *    OG/Twitter tags de la entidad (partido/competición/jugador/equipo).
 * Googlebot se EXCLUYE a propósito (renderiza JS; servirle shell sería
 * cloaking). Solo bots de unfurl: WhatsApp, Telegram, Twitter, Facebook,
 * LinkedIn, Slack, Discord.
 */

const db = require('../../../database/db');

const SITE_URL = (process.env.SITE_URL || 'https://scorehub-pocho.vercel.app').replace(/\/+$/, '');

const PREVIEW_BOTS = [
  /whatsapp/i,
  /telegrambot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
  /facebot/i,
  /linkedinbot/i,
  /slackbot/i,
  /discordbot/i,
];

function isPreviewBot(ua) {
  return !!ua && PREVIEW_BOTS.some((re) => re.test(ua));
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET /sitemap.xml — dinámico desde DB (solo columnas slim).
 * Edge-cache 1h: los crawlers lo piden poco y pesa ~100KB.
 */
async function getSitemap(req, res, next) {
  try {
    const urls = new Set(['/']);
    urls.add('/competiciones');
    urls.add('/buscar');

    // Competiciones activas (de la caché de 5min del helper).
    try {
      const { getActiveCompetitions } = require('../utils/competition');
      const comps = await getActiveCompetitions();
      for (const c of comps) {
        urls.add(`/competicion/${c.id}/standings`);
        urls.add(`/competicion/${c.id}/matches`);
      }
    } catch {}

    // Partidos recientes y próximos (solo IDs, límite 1000).
    try {
      const rows = await db.execAdvanced(
        `SELECT id FROM games
          WHERE start_time > NOW() - INTERVAL '60 days'
          ORDER BY start_time DESC
          LIMIT 1000`
      );
      for (const r of rows) urls.add(`/partido/${r.id}`);
    } catch {}

    const today = new Date().toISOString().slice(0, 10);
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      [...urls]
        .map(
          (u) =>
            `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`
        )
        .join('\n') +
      `\n</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600');
    res.send(body);
  } catch (err) {
    next(err);
  }
}

async function metaForMatch(id) {
  try {
    const rows = await db.execAdvanced(
      `SELECT id, competition_id, home_competitor_id, away_competitor_id, status_group, start_time,
              data->'homeCompetitor'->>'name' AS home_name,
              data->'awayCompetitor'->>'name' AS away_name,
              (data->'homeCompetitor'->>'score')::int AS home_score,
              (data->'awayCompetitor'->>'score')::int AS away_score
         FROM games WHERE id = $1`,
      [Number(id)]
    );
    const g = rows[0];
    if (!g) return null;
    // 365scores usa -1 para marcador desconocido (próximos): no mostrarlo.
    const hs = g.home_score != null && g.home_score >= 0 ? g.home_score : null;
    const as = g.away_score != null && g.away_score >= 0 ? g.away_score : null;
    const score = hs != null && as != null ? ` ${hs}-${as}` : '';
    return {
      title: `${g.home_name || 'Local'}${score} vs ${g.away_name || 'Visita'} · ScoreHub`,
      description: `Partido${score} — previa, estadísticas, alineaciones y tendencias en ScoreHub.`,
      image: `https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_1/v1/Competitors/${g.home_competitor_id}`,
    };
  } catch {
    return null;
  }
}

async function metaForCompetition(id) {
  try {
    const { loadActiveCompetitions } = require('../utils/competition');
    const { byId } = await loadActiveCompetitions();
    const c = byId.get(Number(id));
    if (!c) return null;
    return {
      title: `${c.displayName} · ScoreHub`,
      description: `Partidos, posiciones, estadísticas y noticias de ${c.displayName} (${c.seasonLabel || ''}).`,
      image: `https://imagecache.365scores.com/image/upload/f_png,w_128,h_128,c_limit,q_auto/v1/Competitions/${c.id}`,
    };
  } catch {
    return null;
  }
}

async function metaForAthlete(id) {
  try {
    const { data } = await db.query('athletes', {
      select: 'id, name, data',
      eq: { id: Number(id) },
      maybeSingle: true,
    });
    if (!data) return null;
    const photo = data.data?.photoUrl || data.data?.imageUrl || null;
    return {
      title: `${data.name} · ScoreHub`,
      description: `Perfil, estadísticas y carrera de ${data.name} en ScoreHub.`,
      image: photo,
    };
  } catch {
    return null;
  }
}

async function metaForTeam(id) {
  try {
    const { data } = await db.query('competitors', {
      select: 'id, name, data',
      eq: { id: Number(id) },
      maybeSingle: true,
    });
    if (!data) return null;
    return {
      title: `${data.name} · ScoreHub`,
      description: `Partidos, plantel y estadísticas de ${data.name} en ScoreHub.`,
      image: `https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_1/v1/Competitors/${data.id}`,
    };
  } catch {
    return null;
  }
}

function metaPage(url, meta) {
  const title = esc(meta?.title || 'ScoreHub · Fútbol multi-competición');
  const desc = esc(meta?.description || 'Partidos en vivo, tablas y estadísticas.');
  const image = meta?.image ? `<meta property="og:image" content="${esc(meta.image)}" />` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(url)}" />
${image}
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<link rel="canonical" href="${esc(url)}" />
</head><body><p><a href="${esc(url)}">Abrir en ScoreHub</a></p></body></html>`;
}

/**
 * Middleware: si es bot de preview y la ruta es entidad conocida,
 * responde HTML con metas y NO cae al SPA. En cualquier fallo → next().
 */
async function botMeta(req, res, next) {
  try {
    if (req.method !== 'GET' || !isPreviewBot(req.headers['user-agent'])) return next();
    const m = req.path.match(/^\/(partido|competicion|player|equipo)\/(\d+)/);
    if (!m) return next();
    const [, kind, id] = m;
    let meta = null;
    if (kind === 'partido') meta = await metaForMatch(id);
    else if (kind === 'competicion') meta = await metaForCompetition(id);
    else if (kind === 'player') meta = await metaForAthlete(id);
    else if (kind === 'equipo') meta = await metaForTeam(id);
    if (!meta) return next();
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600');
    // Crítico: el edge cachea por URL; sin Vary, la variante bot se le
    // serviría a navegadores (y viceversa). Separa ambas variantes.
    res.set('Vary', 'User-Agent');
    res.send(metaPage(`${SITE_URL}${req.path}`, meta));
  } catch {
    next();
  }
}

module.exports = { getSitemap, botMeta, isPreviewBot, SITE_URL };
