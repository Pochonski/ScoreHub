import type {
  Athlete,
  AthleteDetail,
  AthleteHighlightGroup,
  AthleteLastMatch,
} from '@/domain/entities/Athlete'
import { AthleteSchema } from '@/infrastructure/validation/schemas'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

function parseDetails(raw: unknown): AthleteDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: AthleteDetail[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const title = str(item.title)
    const value = str(item.value)
    if (title && value) out.push({ title, value })
  }
  return out.length ? out : undefined
}

function parseHighlights(raw: unknown): AthleteHighlightGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: AthleteHighlightGroup[] = []
  for (const group of raw) {
    if (!isRecord(group)) continue
    const name = str(group.name)
    const statsRaw = group.stats
    if (!name || !Array.isArray(statsRaw)) continue
    const stats = []
    for (const s of statsRaw) {
      if (!isRecord(s)) continue
      const sName = str(s.shortName) || str(s.name)
      const value = str(s.value)
      if (!sName || value == null) continue
      stats.push({
        name: sName,
        shortName: str(s.shortName) ?? undefined,
        value,
        isTop: s.isTop === true,
      })
    }
    if (stats.length) out.push({ name, stats })
  }
  return out.length ? out : undefined
}

/**
 * Normaliza `lastMatches: { games: [...] }` del upstream.
 * Minutos = athleteStats tipo 229, rating = tipo 0 (trae bgColor).
 */
function parseLastMatches(raw: unknown): AthleteLastMatch[] | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.games)) return undefined
  const out: AthleteLastMatch[] = []
  for (const entry of raw.games) {
    if (!isRecord(entry) || !isRecord(entry.game)) continue
    const game = entry.game
    const gameId = num(game.id)
    if (gameId == null) continue
    const home = isRecord(game.homeCompetitor) ? game.homeCompetitor : null
    const away = isRecord(game.awayCompetitor) ? game.awayCompetitor : null
    const homeName = (home && str(home.name)) || 'Local'
    const awayName = (away && str(away.name)) || 'Visita'
    const stats = Array.isArray(entry.athleteStats)
      ? entry.athleteStats.filter(isRecord)
      : []
    const minutesRaw = stats.find((s) => s.type === 229)?.value
    const ratingRaw = stats.find((s) => s.type === 0)
    const ratingValue = ratingRaw ? str(ratingRaw.value) : null
    out.push({
      gameId,
      startTime: str(game.startTime) ?? undefined,
      competitionName: str(game.competitionDisplayName) ?? undefined,
      statusText: str(game.statusText) ?? str(game.shortStatusText) ?? undefined,
      home: { name: homeName, score: home ? num(home.score) : null },
      away: { name: awayName, score: away ? num(away.score) : null },
      played: entry.played === true,
      didNotPlayReason: str(entry.didNotPlayReason) ?? undefined,
      minutes: minutesRaw != null ? num(minutesRaw) : null,
      rating: ratingValue
        ? { value: ratingValue, bgColor: ratingRaw ? str(ratingRaw.bgColor) : null }
        : null,
    })
  }
  return out.length ? out : undefined
}

export function mapAthlete(raw: Record<string, unknown>): Athlete {
  const parsed = AthleteSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      id: raw.id as number,
      name: (raw.name as string) || '',
      shortName: raw.shortName as string,
    }
  }
  return {
    ...parsed.data,
    playerDetails: parseDetails(raw.playerDetails),
    highlightStats: parseHighlights(raw.highlightStats),
    lastMatches: parseLastMatches(raw.lastMatches),
  }
}

export function mapAthletes(raw: Record<string, unknown>[]): Athlete[] {
  return raw.map(mapAthlete)
}
