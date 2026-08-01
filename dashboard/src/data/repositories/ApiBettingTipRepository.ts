import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import type { BettingTipRepository } from '@/domain/repositories/BettingTipRepository'
import type { Trend, BettingTip } from '@/domain/entities/BettingTip'

/**
 * Mapea un trend crudo de 365scores al entity Trend. El upstream incluye
 * `id`, `text`, `cause`, `betCTA`, `percentage`, `lineTypeId`, `gameId`,
 * `competitorIds`, `confidenceTrendIds`, `isGeneralGameBet`. Solo
 * preservamos los campos útiles para la UI.
 */
function mapTrend(raw: Record<string, unknown>): Trend {
  return {
    id: typeof raw.id === 'number' ? raw.id : undefined,
    text: (raw.text as string) || '',
    cause: raw.cause as string | undefined,
    betCTA: raw.betCTA as string | undefined,
    isTop: Boolean(raw.isTop),
    percentage: typeof raw.percentage === 'number' ? raw.percentage : 0,
    lineTypeId: typeof raw.lineTypeId === 'number' ? raw.lineTypeId : 0,
    lineTypeLabel: typeof raw.lineTypeLabel === 'string' ? raw.lineTypeLabel : undefined,
    gameId: typeof raw.gameId === 'number' ? raw.gameId : undefined,
    competitionId: typeof raw.competitionId === 'number' ? raw.competitionId : undefined,
  }
}

export class ApiBettingTipRepository implements BettingTipRepository {
  async getCompetitionTrends(competitionId?: number): Promise<Trend[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.trends, {
      params: competitionId ? { competitionId } : undefined,
    })
    return (raw ?? []).map(mapTrend)
  }

  async getGameTips(gameId: number): Promise<BettingTip | null> {
    return apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(gameId))
  }
}
