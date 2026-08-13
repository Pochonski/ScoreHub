/**
 * shared/newsImageProxy.ts — Helper para proxy de imágenes de noticias.
 *
 * Auditoría 2026-Q3 (post-deploy): el dashboard ahora pasa por
 * `/api/news/image?url=...` para todas las URLs externas de news. Esto:
 * - Permite CSP estricto (sólo 'self', imagecache.365scores.com, data:)
 * - Valida hosts permitidos en el backend (allowlist, ver
 *   newsImageProxyController.js)
 * - Cacheable en Vercel CDN (Cache-Control: public, max-age=600)
 * - Evita exponer el browser del usuario a dominios third-party
 */

const PROXY_PATH = '/api/news/image';

export function proxyImageUrl(originalUrl: string | undefined): string | undefined {
  if (!originalUrl) return undefined;

  // Si ya es URL de proxy, devolver tal cual.
  if (originalUrl.startsWith(PROXY_PATH)) return originalUrl;

  // URLs absolutas: pasar por proxy.
  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    return `${PROXY_PATH}?url=${encodeURIComponent(originalUrl)}`;
  }

  // URLs relativas (data:, blob:, /api/...): devolver tal cual.
  return originalUrl;
}