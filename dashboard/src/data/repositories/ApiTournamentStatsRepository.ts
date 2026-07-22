import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import type { TournamentStatsRepository } from '@/domain/repositories/TournamentStatsRepository'
import type { TournamentStatEntry } from '@/domain/entities/BettingTip'

export class ApiTournamentStatsRepository implements TournamentStatsRepository {
  private params(competitionId?: number) {
    return competitionId ? { competitionId } : undefined
  }

  async getTopScorers(competitionId?: number): Promise<TournamentStatEntry[]> {
    return apiClient.get<TournamentStatEntry[]>(ENDPOINTS.statsScorers, { params: this.params(competitionId) })
  }

  async getTopAssists(competitionId?: number): Promise<TournamentStatEntry[]> {
    return apiClient.get<TournamentStatEntry[]>(ENDPOINTS.statsAssists, { params: this.params(competitionId) })
  }

  async getTopRatings(competitionId?: number): Promise<TournamentStatEntry[]> {
    return apiClient.get<TournamentStatEntry[]>(ENDPOINTS.statsRatings, { params: this.params(competitionId) })
  }

  async getTeamOfWeek(competitionId?: number): Promise<unknown> {
    return apiClient.get<unknown>(ENDPOINTS.statsTeamOfWeek, { params: this.params(competitionId) })
  }
}
