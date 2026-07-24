import { useQuery } from '@tanstack/react-query'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import type { GetGamesParams } from '@/domain/repositories/GameRepository'

/**
 * TanStack Query versions. External shapes preserved:
 *  - useGames(params?)          → { games, loading, error, refetch }
 *  - useLiveGames(params?)      → { games, loading, error, refetch }
 *  - useFeaturedGame(cid?)      → { game, loading, refetch }
 */

export function useGames(params?: GetGamesParams) {
  const qKey = [
    'games',
    params?.statusGroup ?? null,
    params?.stage ?? null,
    params?.teamId ?? null,
    params?.competitionId ?? null,
    params?.all ?? false,
  ] as const

  const { data, isLoading, error, refetch } = useQuery<Game[]>({
    queryKey: qKey,
    queryFn: async () => {
      const gameRepo = DiContainer.getInstance().getGameRepository()
      return gameRepo.getGames(params)
    },
    staleTime: 30 * 1000,
  })

  const errMsg = error instanceof Error ? error.message : null
  return {
    games: data ?? [],
    loading: isLoading,
    error: errMsg,
    refetch: () => refetch(),
  }
}

export function useLiveGames(params?: { competitionId?: number; all?: boolean }) {
  const qKey = ['live-games', params?.competitionId ?? null, params?.all ?? false] as const

  const { data, isLoading, error, refetch } = useQuery<Game[]>({
    queryKey: qKey,
    queryFn: async () => {
      const gameRepo = DiContainer.getInstance().getGameRepository()
      return gameRepo.getLiveGames(params)
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // 30s polling — was the previous behavior in DashboardPage
  })

  const errMsg = error instanceof Error ? error.message : null
  return {
    games: data ?? [],
    loading: isLoading,
    error: errMsg,
    refetch: () => refetch(),
  }
}

export function useFeaturedGame(competitionId?: number | null) {
  const qKey = ['featured-game', competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<Game | null>({
    queryKey: qKey,
    queryFn: async () => {
      const gameRepo = DiContainer.getInstance().getGameRepository()
      const d = await gameRepo.getFeaturedGame(competitionId ?? undefined)
      return d ?? null
    },
    staleTime: 30 * 1000,
  })

  return {
    game: data ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
