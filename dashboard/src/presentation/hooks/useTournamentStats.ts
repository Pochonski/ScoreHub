import { useQuery } from '@tanstack/react-query'
import type { TournamentStatEntry } from '@/domain/entities/BettingTip'
import { DiContainer } from '@/infrastructure/di/DiContainer'

interface TeamOfWeekData {
  formation: string
  players: Array<{ name: string; rating: number; position: string; photoUrl?: string }>
}

interface TournamentStatsData {
  scorers: TournamentStatEntry[]
  assists: TournamentStatEntry[]
  ratings: TournamentStatEntry[]
  teamOfWeek: TeamOfWeekData | null
}

const EMPTY: TournamentStatsData = {
  scorers: [],
  assists: [],
  ratings: [],
  teamOfWeek: null,
}

/**
 * TanStack Query version. External shape preserved:
 * returns { scorers, assists, ratings, teamOfWeek, loading, refetch }.
 */
export function useTournamentStats(competitionId?: number | null, seasonNum?: number | null) {
  const qKey = ['tournament-stats', competitionId ?? null, seasonNum ?? null] as const

  const { data, isLoading, refetch } = useQuery<TournamentStatsData>({
    queryKey: qKey,
    queryFn: async () => {
      const repo = DiContainer.getInstance().getTournamentStatsRepository()
      const cid = competitionId ?? undefined
      const sn = seasonNum ?? undefined
      try {
        const [s, a, r, tow] = await Promise.all([
          repo.getTopScorers(cid, sn),
          repo.getTopAssists(cid, sn),
          repo.getTopRatings(cid, sn),
          repo.getTeamOfWeek(cid, sn),
        ])
        return { scorers: s, assists: a, ratings: r, teamOfWeek: (tow as TeamOfWeekData | null) ?? null }
      } catch {
        return EMPTY
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    ...(data ?? EMPTY),
    loading: isLoading,
    refetch: () => refetch(),
  }
}
