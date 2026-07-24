import { useQuery } from '@tanstack/react-query'
import type { HistoryStats } from '@/domain/entities/HistoryStats'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getHistoryRepository()

/**
 * TanStack Query version. External shape preserved:
 * returns { stats, loading, refetch }.
 */
export function useHistoryStats(competitionId?: number | null) {
  const qKey = ['history-stats', competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<HistoryStats | null>({
    queryKey: qKey,
    queryFn: async () => {
      try {
        const d = await repo.getHistoryStats(competitionId ?? undefined)
        return d ?? null
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    stats: data ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
