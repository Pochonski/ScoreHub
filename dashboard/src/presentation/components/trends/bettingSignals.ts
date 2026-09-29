/**
 * Señales de apuesta: tendencias (historial) vs predicciones (comunidad).
 * Reglas de producto — NUNCA mezclar escalas:
 *   - trends: percentage es fracción 0–1 de ocurrencia histórica.
 *   - predicciones: percentage es % de votos 0–100 con totalVotes.
 */

/** Votos mínimos para mostrar una encuesta expandida. Debajo: colapsada. */
export const MIN_VOTES = 100
/** Debajo de esto la encuesta se oculta (ruido muestral). */
export const HIDE_BELOW_VOTES = 30

export type SampleLevel = 'solid' | 'small' | 'hide'

export function sampleLevel(totalVotes: number | null | undefined): SampleLevel {
  const v = typeof totalVotes === 'number' && Number.isFinite(totalVotes) ? totalVotes : 0
  if (v < HIDE_BELOW_VOTES) return 'hide'
  if (v < MIN_VOTES) return 'small'
  return 'solid'
}

export function formatVotes(totalVotes: number): string {
  return `${totalVotes.toLocaleString('es-ES')} votos`
}

/**
 * Extrae el tamaño de muestra del texto del trend
 * ("... - 17/18 Últimos partidos" → "17/18"). Null si no hay patrón N/M.
 */
export function extractSampleSize(text: string | undefined): string | null {
  if (!text) return null
  const m = text.match(/(\d+)\s*\/\s*(\d+)/)
  return m ? `${m[1]}/${m[2]}` : null
}
