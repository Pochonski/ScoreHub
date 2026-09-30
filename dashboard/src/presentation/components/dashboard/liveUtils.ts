import type { Game } from '@/domain/entities/Game'
import type { Competition } from '@/domain/entities/Competition'

export interface LiveGroup {
  competition: Competition
  games: Game[]
}

/**
 * Agrupa vivos por competición, en el orden dado (featuredSorted).
 * Solo incluye competiciones con al menos un vivo. Dentro del grupo,
 * ordena por minuto desc (sin minuto al final).
 */
export function groupLiveByCompetition(
  games: Game[],
  competitions: Competition[],
  fallback?: Competition | null
): LiveGroup[] {
  const byComp = new Map<number, Game[]>()
  const orphans: Game[] = []
  for (const g of games) {
    const cid = g.competitionId
    if (cid == null) {
      orphans.push(g)
      continue
    }
    const list = byComp.get(cid)
    if (list) list.push(g)
    else byComp.set(cid, [g])
  }
  const sortByMinute = (list: Game[]) =>
    [...list].sort((a, b) => (b.minute ?? -1) - (a.minute ?? -1))
  const out: LiveGroup[] = []
  for (const c of competitions) {
    const list = byComp.get(c.id)
    if (list && list.length > 0) {
      out.push({ competition: c, games: sortByMinute(list) })
    }
  }
  // Partidos sin competitionId van al grupo fallback (liga activa) o se
  // descartan si no hay fallback — nunca silenciosamente a otro grupo.
  if (orphans.length > 0 && fallback) {
    const existing = out.find((g) => g.competition.id === fallback.id)
    if (existing) {
      existing.games = sortByMinute([...existing.games, ...orphans])
    } else {
      out.push({ competition: fallback, games: sortByMinute(orphans) })
    }
  }
  return out
}

/**
 * Minuto mostrable en vivo. El upstream a veces manda -1 (por empezar):
 * en ese caso no se muestra número, solo "EN VIVO".
 */
export function formatLiveMinute(minute: number | null | undefined): string | null {
  if (minute == null || !Number.isFinite(minute) || minute < 1) return null
  return `${Math.floor(minute)}'`
}
