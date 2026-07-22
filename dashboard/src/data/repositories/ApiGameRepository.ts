import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapGame, mapGames } from '@/data/mappers/GameMapper'
import type { GameRepository, GetGamesParams } from '@/domain/repositories/GameRepository'
import type { Game, MatchEvent, GameStat } from '@/domain/entities/Game'
import type { Lineup } from '@/domain/entities/Lineup'
import type { BettingTip, Trend } from '@/domain/entities/BettingTip'
import type { Prediction } from '@/domain/entities/Prediction'

function buildGamesParams(params?: GetGamesParams): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {
    statusGroup: params?.statusGroup,
    stage: params?.stage,
    teamId: params?.teamId,
  }
  if (params?.all) out.all = 'true'
  else if (params?.competitionId != null) out.competitionId = params.competitionId
  return out
}

export class ApiGameRepository implements GameRepository {
  async getGames(params?: GetGamesParams): Promise<Game[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.matches, {
      params: buildGamesParams(params),
    })
    return mapGames(raw)
  }

  async getLiveGames(params?: { competitionId?: number; all?: boolean }): Promise<Game[]> {
    const query: Record<string, string | number | undefined> = {}
    if (params?.all) query.all = 'true'
    else if (params?.competitionId != null) query.competitionId = params.competitionId
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.matchesLive, {
      params: query,
    })
    return mapGames(raw)
  }

  async getFeaturedGame(competitionId?: number): Promise<Game | null> {
    const raw = await apiClient.get<Record<string, unknown> | null>(
      ENDPOINTS.matchesFeatured,
      { params: competitionId ? { competitionId } : undefined }
    )
    return raw ? mapGame(raw) : null
  }

  async getGameById(id: number): Promise<Game | null> {
    const raw = await apiClient.get<Record<string, unknown> | null>(ENDPOINTS.matchById(id))
    return raw ? mapGame(raw) : null
  }

  async getGameStats(id: number): Promise<GameStat[]> {
    return apiClient.get<GameStat[]>(ENDPOINTS.matchStats(id))
  }

  async getGameH2h(id: number): Promise<{ recentGames: Game[]; h2hGames: Game[] } | null> {
    const raw = await apiClient.get<Record<string, unknown> | null>(ENDPOINTS.matchH2h(id))
    if (!raw) return null
    return {
      recentGames: mapGames((raw.recentGames as Record<string, unknown>[]) || []),
      h2hGames: mapGames((raw.h2hGames as Record<string, unknown>[]) || []),
    }
  }

  async getGameLineups(id: number): Promise<{ home: Lineup; away: Lineup } | null> {
    return apiClient.get<{ home: Lineup; away: Lineup } | null>(ENDPOINTS.matchLineups(id))
  }

  async getGamePreStats(id: number): Promise<GameStat[]> {
    return apiClient.get<GameStat[]>(ENDPOINTS.matchPreStats(id))
  }

  async getGameTips(id: number): Promise<BettingTip | null> {
    return apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(id))
  }

  async getGameTrends(id: number): Promise<Trend[]> {
    return apiClient.get<Trend[]>(ENDPOINTS.matchTrends(id))
  }

  async getGamePredictions(id: number): Promise<Prediction[]> {
    return apiClient.get<Prediction[]>(ENDPOINTS.matchPredictions(id))
  }

  async getGameTimeline(id: number): Promise<MatchEvent[]> {
    return apiClient.get<MatchEvent[]>(ENDPOINTS.matchTimeline(id))
  }
}
