import { useQuery } from '@tanstack/react-query'
import type { HistoryEdition } from '@/domain/entities/HistoryEdition'
import type { HistoricalMatchStats, HistoricalStat } from '@/domain/entities/HistoricalMatchStats'
import type { HistoricalMatchLineup, HistoricalLineupMember } from '@/domain/entities/HistoricalMatchLineup'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getHistoryRepository()

function mapStats(raw: Record<string, unknown> | null): HistoricalMatchStats | null {
  if (!raw || !raw.statistics || !raw.competitors) return null
  const competitors = raw.competitors as Record<string, unknown>[]
  const homeComp = competitors[0]
  const awayComp = competitors[1]
  const games = raw.games as Record<string, unknown>[]
  const game = games?.[0]
  if (!homeComp || !awayComp) return null

  const homeId = homeComp.id as number
  const statsRaw = raw.statistics as Record<string, unknown>[]
  const statsMap = new Map<string, { home: number | string; away: number | string }>()

  for (const s of statsRaw) {
    const name = String(s.name || '')
    if (!statsMap.has(name)) statsMap.set(name, { home: '', away: '' })
    const entry = statsMap.get(name)!
    if (s.competitorId === homeId) entry.home = (s.value ?? s.valuePercentage ?? '') as number | string
    else entry.away = (s.value ?? s.valuePercentage ?? '') as number | string
  }

  const stats: HistoricalStat[] = []
  for (const s of statsRaw) {
    const name = String(s.name || '')
    if (s.competitorId === homeId) {
      stats.push({
        name,
        home: (s.value ?? '') as number | string,
        away: statsMap.get(name)?.away ?? ('' as number | string),
      })
    }
  }

  return {
    seasonNum: (game?.seasonNum ?? 0) as number,
    year: game?.startTime ? new Date(game.startTime as string).getFullYear() : 0,
    matchId: (game?.id ?? games?.[0]?.id ?? 0) as number,
    homeTeam: homeComp.name as string,
    awayTeam: awayComp.name as string,
    homeScore: ((game?.homeCompetitor as Record<string, unknown>)?.score ?? 0) as number,
    awayScore: ((game?.awayCompetitor as Record<string, unknown>)?.score ?? 0) as number,
    homePenaltyScore: ((game?.homeCompetitor as Record<string, unknown>)?.penaltyScore ?? undefined) as
      number | undefined,
    awayPenaltyScore: ((game?.awayCompetitor as Record<string, unknown>)?.penaltyScore ?? undefined) as
      number | undefined,
    stats,
    venue: ((game?.venue as Record<string, unknown>)?.name ?? '') as string,
    date: (game?.startTime ?? '') as string,
  }
}

function mapLineups(raw: Record<string, unknown> | null): HistoricalMatchLineup | null {
  if (!raw?.game) return null
  const g = raw.game as Record<string, unknown>
  const homeLU = (g.homeCompetitor as Record<string, unknown>)?.lineups as Record<string, unknown> | undefined
  const awayLU = (g.awayCompetitor as Record<string, unknown>)?.lineups as Record<string, unknown> | undefined
  const members = (g.members || []) as Record<string, unknown>[]

  const mapSide = (side: Record<string, unknown> | undefined, _competitorId: number) => {
    if (!side)
      return {
        formation: undefined as string | undefined,
        starting: [] as HistoricalLineupMember[],
        bench: [] as HistoricalLineupMember[],
        coach: undefined as string | undefined,
      }
    const formation = side.formation as string | undefined
    const sideMembers = (side.members || []) as Record<string, unknown>[]

    const mapMember = (m: Record<string, unknown>): HistoricalLineupMember => {
      const detail = members.find((mem: Record<string, unknown>) => mem.id === m.id)
      return {
        name: ((detail?.shortName || detail?.name || m.name) as string) || '',
        shirtNumber: (detail?.jerseyNumber as number | undefined) ?? undefined,
        isCaptain: (m.isCaptain as boolean) || false,
        photoUrl: undefined,
      }
    }

    const starting = sideMembers
      .filter((m: Record<string, unknown>) => m.statusText === 'Starting')
      .map(mapMember)
    const bench = sideMembers
      .filter((m: Record<string, unknown>) => m.statusText === 'Substitute')
      .map(mapMember)

    const coachMember = members.find(
      (m: Record<string, unknown>) =>
        m.isCoach || m.role === 'Coach' || (m.formation as Record<string, unknown>)?.id === -1
    )
    const coach =
      (coachMember?.name as string) ||
      (sideMembers.find((m: Record<string, unknown>) => m.statusText === 'Coach')?.name as string) ||
      undefined

    return { formation, starting, bench, coach }
  }

  const homeId = (g.homeCompetitor as Record<string, unknown>)?.id as number
  const awayId = (g.awayCompetitor as Record<string, unknown>)?.id as number
  const home = mapSide(homeLU, homeId)
  const away = mapSide(awayLU, awayId)

  return {
    seasonNum: (g.seasonNum ?? 0) as number,
    year: g.startTime ? new Date(g.startTime as string).getFullYear() : 0,
    matchId: (g.id ?? 0) as number,
    homeTeam: ((g.homeCompetitor as Record<string, unknown>)?.name ?? '') as string,
    awayTeam: ((g.awayCompetitor as Record<string, unknown>)?.name ?? '') as string,
    homeFormation: home.formation,
    awayFormation: away.formation,
    homeStarting: home.starting,
    awayStarting: away.starting,
    homeBench: home.bench,
    awayBench: away.bench,
    homeCoach: home.coach,
    awayCoach: away.coach,
  }
}

export function useHistoryDetail(seasonNum: number | null, competitionId?: number | null) {
  const qKey = ['history-detail', seasonNum, competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<{
    edition: HistoryEdition | null
    matchStats: HistoricalMatchStats | null
    lineups: HistoricalMatchLineup | null
  }>({
    queryKey: qKey,
    enabled: seasonNum != null,
    queryFn: async () => {
      const sn = seasonNum as number
      const cid = competitionId ?? undefined
      try {
        const [ed, rawStats, rawLineups] = await Promise.all([
          repo.getHistoryBySeason(sn, cid),
          repo.getHistoryMatchStats(sn, cid).catch(() => null),
          repo.getHistoryMatchLineup(sn, cid).catch(() => null),
        ])
        return {
          edition: ed,
          matchStats: mapStats(rawStats as Record<string, unknown> | null),
          lineups: mapLineups(rawLineups as Record<string, unknown> | null),
        }
      } catch {
        return { edition: null, matchStats: null, lineups: null }
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    edition: data?.edition ?? null,
    matchStats: data?.matchStats ?? null,
    lineups: data?.lineups ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
