import { useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
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

/**
 * Tips de varios partidos en paralelo. Comparte queryKey con useMatchTips para
 * deduplicar entre el detalle de partido y el análisis de la competición.
 * Devuelve un Map gameId → BettingTip|null y un flag de carga.
 */
export function useMatchTipsForGames(gameIds: number[]) {
  const results = useQueries({
    queries: gameIds.map((id) => ({
      queryKey: ['match-tips', id] as const,
      queryFn: async () => apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(id)),
      enabled: id != null,
      staleTime: 30 * 1000,
    })),
  })

  const loading = results.some((r) => r.isLoading)

  // Serializar por ids + estado evita recomputar el Map en cada render.
  const signature = gameIds
    .map((id, i) => `${id}:${results[i]?.data?.gameId ?? ''}:${results[i]?.isLoading ? 'l' : 'd'}`)
    .join('|')

  const tipsByGame = useMemo(() => {
    const map = new Map<number, BettingTip | null>()
    gameIds.forEach((id, i) => map.set(id, results[i]?.data ?? null))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return { tipsByGame, loading }
}
