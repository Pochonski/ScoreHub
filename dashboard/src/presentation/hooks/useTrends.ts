import { useQuery } from '@tanstack/react-query'
import type { Trend } from '@/domain/entities/BettingTip'
import { DiContainer } from '@/infrastructure/di/DiContainer'

/**
 * TanStack Query version. External shape preserved:
 * returns { trends, loading, refetch }.
 */
export function useTrends(competitionId?: number | null) {
  const qKey = ['trends', 'competition', competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<Trend[]>({
    queryKey: qKey,
    queryFn: async () => {
      const repo = DiContainer.getInstance().getBettingTipRepository()
      return repo.getCompetitionTrends(competitionId ?? undefined)
    },
    staleTime: 60 * 1000,
  })

  return {
    trends: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}
