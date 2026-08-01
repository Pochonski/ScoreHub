// Helpers de URLs de imágenes del CDN de 365scores (mismo patrón que el
// backend en services/images.js). Se usan cuando el frontend tiene los ids
// pero no una URL pre-armada (ej. logo de competición, bandera de país).

const CDN = 'https://imagecache.365scores.com/image/upload'

/** Logo de la competición (torneo). */
export function competitionLogoUrl(competitionId: number, imageVersion = 1): string {
  return `${CDN}/f_png,w_128,h_128,c_limit,q_auto/v${imageVersion}/Competitions/${competitionId}`
}

/** Bandera del país. */
export function countryFlagUrl(countryId?: number | null): string | null {
  if (!countryId) return null
  return `${CDN}/f_auto,q_auto/Countries/${countryId}.png`
}
