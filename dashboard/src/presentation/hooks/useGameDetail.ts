import { useQuery } from '@tanstack/react-query'
import type { Game, MatchEvent, GameStat } from '@/domain/entities/Game'
import type { Lineup } from '@/domain/entities/Lineup'
import type { BettingTip } from '@/domain/entities/BettingTip'
import type { Prediction } from '@/domain/entities/Prediction'
import type { News } from '@/domain/entities/News'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

export interface GameDetail {
  game: Game | null
  stats: GameStat[]
  lineups: { home: Lineup; away: Lineup } | null
  timeline: MatchEvent[]
  predictions: Prediction[]
  tips: BettingTip | null
  news: News[]
}

const EMPTY: GameDetail = {
  game: null,
  stats: [],
  lineups: null,
  timeline: [],
  predictions: [],
  tips: null,
  news: [],
}

/**
 * TanStack Query version. External shape preserved:
 * returns { game, stats, lineups, timeline, predictions, tips, news,
 *   loading, error, refetch }.
 */
export function useGameDetail(gameId: number | null) {
  const qKey = ['game-detail', gameId] as const

  const { data, isLoading, error, refetch } = useQuery<GameDetail>({
    queryKey: qKey,
    enabled: gameId != null,
    queryFn: async () => {
      const gid = gameId as number
      const repo = DiContainer.getInstance().getGameRepository()
      const [game, stats, lineups, timeline, predictions, tips, news] = await Promise.all([
        repo.getGameById(gid).catch(() => null),
        repo.getGameStats(gid).catch(() => [] as GameStat[]),
        repo.getGameLineups(gid).catch(() => null),
        repo.getGameTimeline(gid).catch(() => [] as MatchEvent[]),
        repo.getGamePredictions(gid).catch(() => [] as Prediction[]),
        repo.getGameTips(gid).catch(() => null),
        apiClient.get<News[]>(ENDPOINTS.newsByGame(gid)).catch(() => [] as News[]),
      ])
      return { game, stats, lineups, timeline, predictions, tips, news }
    },
    staleTime: 30 * 1000,
  })

  const errMsg =
    error && !(data?.game) ? 'No se pudieron cargar los datos del partido' : null
  const err = error instanceof Error ? errMsg || error.message : errMsg

  return {
    ...(data ?? EMPTY),
    loading: isLoading,
    error: err,
    refetch: () => refetch(),
  }
}
