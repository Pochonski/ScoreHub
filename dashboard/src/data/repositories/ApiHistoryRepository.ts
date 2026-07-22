import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import type { HistoryRepository } from '@/domain/repositories/HistoryRepository'
import type { HistoryEdition } from '@/domain/entities/HistoryEdition'
import type { HistoryStats } from '@/domain/entities/HistoryStats'
import type { HistoricalMatchStats } from '@/domain/entities/HistoricalMatchStats'
import type { HistoricalMatchLineup } from '@/domain/entities/HistoricalMatchLineup'

export class ApiHistoryRepository implements HistoryRepository {
  async getHistory(competitionId?: number): Promise<HistoryEdition[]> {
    return apiClient.get<HistoryEdition[]>(ENDPOINTS.history, {
      params: competitionId ? { competitionId } : undefined,
    })
  }

  async getHistoryStats(competitionId?: number): Promise<HistoryStats> {
    return apiClient.get<HistoryStats>(ENDPOINTS.historyStats, {
      params: competitionId ? { competitionId } : undefined,
    })
  }

  async getHistoryBySeason(seasonNum: number, competitionId?: number): Promise<HistoryEdition | null> {
    return apiClient.get<HistoryEdition | null>(ENDPOINTS.historyBySeason(seasonNum), {
      params: competitionId ? { competitionId } : undefined,
    })
  }

  async getHistoryMatchStats(seasonNum: number, competitionId?: number): Promise<HistoricalMatchStats | null> {
    return apiClient.get<HistoricalMatchStats | null>(ENDPOINTS.historyMatchStats(seasonNum), {
      params: competitionId ? { competitionId } : undefined,
    })
  }

  async getHistoryMatchLineup(seasonNum: number, competitionId?: number): Promise<HistoricalMatchLineup | null> {
    return apiClient.get<HistoricalMatchLineup | null>(ENDPOINTS.historyMatchLineup(seasonNum), {
      params: competitionId ? { competitionId } : undefined,
    })
  }
}
