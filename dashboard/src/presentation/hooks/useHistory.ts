import { useQuery } from '@tanstack/react-query'
import type { HistoryEdition } from '@/domain/entities/HistoryEdition'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getHistoryRepository()

/**
 * TanStack Query version. External shape preserved:
 * returns { history, loading, refetch }.
 */
export function useHistory(competitionId?: number | null) {
  const qKey = ['history', competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<HistoryEdition[]>({
    queryKey: qKey,
    queryFn: async () => {
      try {
        return await repo.getHistory(competitionId ?? undefined)
      } catch {
        return [] as HistoryEdition[]
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    history: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}
