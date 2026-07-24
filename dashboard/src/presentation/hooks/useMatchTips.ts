import { useQuery } from '@tanstack/react-query'
import type { BettingTip } from '@/domain/entities/BettingTip'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

/**
 * TanStack Query version. External shape preserved:
 * returns { tips, loading, refetch }.
 */
export function useMatchTips(gameId: number | null) {
  const qKey = ['match-tips', gameId] as const

  const { data, isLoading, refetch } = useQuery<BettingTip | null>({
    queryKey: qKey,
    queryFn: async () => {
      if (gameId == null) return null
      return apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(gameId))
    },
    enabled: gameId != null,
    staleTime: 30 * 1000,
  })

  return {
    tips: data ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
