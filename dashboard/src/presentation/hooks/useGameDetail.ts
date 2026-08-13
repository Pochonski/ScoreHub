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

export type GameSection = 'game' | 'stats' | 'lineups' | 'timeline' | 'predictions' | 'tips' | 'news'

/**
 * Auditoría 2026-Q3 Fase 7.4: cada sección del game detail puede fallar
 * independientemente. El hook expone `partialError` para que la UI muestre
 * un banner discreto sin bloquear el resto de los datos.
 */
export interface PartialError {
  section: GameSection
  message: string
}

export interface UseGameDetailResult {
  game: Game | null
  stats: GameStat[]
  lineups: { home: Lineup; away: Lineup } | null
  timeline: MatchEvent[]
  predictions: Prediction[]
  tips: BettingTip | null
  news: News[]
  loading: boolean
  error: string | null
  partialError: PartialError[]
  refetch: () => void
}

/**
 * Carga todas las secciones de un partido con degradación graceful.
 * - Cada fetch se hace en paralelo via Promise.allSettled.
 * - Si una sección falla, se usa un valor por default y se agrega a
 *   `partialError`. Las otras secciones siguen siendo visibles.
 * - Si el game base falla, `error` se setea (fatal), pero las otras
 *   secciones pueden seguir devolviendo data parcial.
 */
export function useGameDetail(gameId: number | null): UseGameDetailResult {
  const qKey = ['game-detail', gameId] as const

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qKey,
    enabled: gameId != null,
    queryFn: async (): Promise<{ detail: GameDetail; partialError: PartialError[] }> => {
      const gid = gameId as number
      const repo = DiContainer.getInstance().getGameRepository()
      const sections: Array<[GameSection, () => Promise<unknown>]> = [
        ['game', () => repo.getGameById(gid)],
        ['stats', () => repo.getGameStats(gid)],
        ['lineups', () => repo.getGameLineups(gid)],
        ['timeline', () => repo.getGameTimeline(gid)],
        ['predictions', () => repo.getGamePredictions(gid)],
        ['tips', () => repo.getGameTips(gid)],
        ['news', () => apiClient.get<News[]>(ENDPOINTS.newsByGame(gid))],
      ]

      const results = await Promise.allSettled(sections.map(([, fn]) => fn()))
      const detail: GameDetail = { ...EMPTY }
      const errors: PartialError[] = []
      sections.forEach(([key], i) => {
        const result = results[i]
        if (result.status === 'fulfilled') {
          ;(detail as Record<string, unknown>)[key] = result.value
        } else {
          ;(detail as Record<string, unknown>)[key] = EMPTY[key]
          errors.push({
            section: key,
            message:
              result.reason instanceof Error ? result.reason.message : 'unknown',
          })
        }
      })
      return { detail, partialError: errors }
    },
    staleTime: 30 * 1000,
  })

  const detail = data?.detail ?? EMPTY
  const partialError = data?.partialError ?? []
  const errMsg =
    error && !detail.game ? 'No se pudieron cargar los datos del partido' : null
  const err = error instanceof Error ? errMsg || error.message : errMsg

  return {
    game: detail.game,
    stats: detail.stats,
    lineups: detail.lineups,
    timeline: detail.timeline,
    predictions: detail.predictions,
    tips: detail.tips,
    news: detail.news,
    loading: isLoading,
    error: err,
    partialError,
    refetch: () => {
      refetch()
    },
  }
}