'use strict';

/**
 * newsImageProxyController — Proxy de imágenes de noticias externas.
 *
 * Auditoría 2026-Q3 (post-deploy): las imágenes de noticias vienen del
 * upstream 365scores o de sitios syndicated. Si las permitiéramos via
 * CSP img-src, abriríamos la superficie de ataque a muchos dominios externos.
 *
 * Solución: el dashboard usa URLs del proxy `/api/news/image?url=<encoded>`
 * y el backend hace fetch upstream con allowlist + timeout + size cap.
 *
 * Estrategia de allowlist (v3 — SLD+1 + exact):
 * - Lista de dominios base + subdominios registrados que difieren del SLD.
 * - Match por hostname === domain || hostname.endsWith('.' + domain).
 * - El log de bloqueo (`blocked host: ...`) permite descubrir nuevos
 *   hosts en runtime y añadirlos al array sin redeploy manual.
 */

const ALLOWED_DOMAINS = [
  // 365scores ecosystem (noticias + assets)
  '365scores.com',
  // Marca + Unidad Editorial
  'marca.com',
  // Marca usa subdominios separados por guion (no SLD-prefixed), así
  // que necesitamos listar 'estaticos-marca.com' explícitamente.
  'estaticos-marca.com',
  'expansion.com',
  'elmundo.es',
  // Elmundo usa UECDN (uecdn.es) como CDN
  'uecdn.es',
  // PRISA / El País (epimg.es = El País Imagen CDN) y As (PRISA también)
  'epimg.es',
  'as.com',
  // EPL static (usado en internacionales)
  'eplstatic.com',
  // Si aparecen más dominios, añadir aquí.
];

function isAllowedHost(hostname) {
  return ALLOWED_DOMAINS.some((domain) => {
    return hostname === domain || hostname.endsWith('.' + domain);
  });
}

const FETCH_TIMEOUT_MS = 4500;
const MAX_BYTES = 5 * 1024 * 1024;

async function proxyNewsImage(req, res) {
  const urlParam = req.query.url;
  if (typeof urlParam !== 'string' || !urlParam) {
    res.status(400).json({ error: 'url query param required' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(urlParam);
  } catch {
    res.status(400).json({ error: 'invalid url' });
    return;
  }

  if (parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'https only' });
    return;
  }

  if (!isAllowedHost(parsed.hostname)) {
    // Log para diagnóstico — si este warning aparece en producción,
    // añadir el host correspondiente a ALLOWED_DOMAINS.
    console.warn(
      `[newsImageProxy] blocked host: ${parsed.hostname} (path=${req.path})`
    );
    res
      .status(403)
      .json({ error: 'host not allowed', host: parsed.hostname });
    return;
  }

  // Fetch upstream con timeout + size cap.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(urlParam, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ScoreHub/1.0 (+image-proxy)',
        Referer: 'https://www.365scores.com/',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const status = upstream.status >= 500 ? 502 : 404;
      res.status(status).json({ error: 'upstream error', status: upstream.status });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    // Tamaño desconocido → cap progresivo por chunks.
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=600, s-maxage=3600');
    res.set('X-Content-Type-Options', 'nosniff');

    const reader = upstream.body.getReader();
    let received = 0;
    res.writeHead(200);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) {
        controller.abort();
        res.end();
        return;
      }
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    if (e.name === 'AbortError') {
      res.status(504).json({ error: 'upstream timeout or too large' });
    } else {
      res.status(502).json({ error: 'proxy error', detail: e.message });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { proxyNewsImage, isAllowedHost, ALLOWED_DOMAINS };