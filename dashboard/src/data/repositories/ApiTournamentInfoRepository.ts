import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import type { TournamentInfoRepository } from '@/domain/repositories/TournamentInfoRepository'
import type { TournamentInfo } from '@/domain/entities/TournamentInfo'

export class ApiTournamentInfoRepository implements TournamentInfoRepository {
  async getTournamentInfo(competitionId?: number): Promise<TournamentInfo> {
    return apiClient.get<TournamentInfo>(ENDPOINTS.tournamentInfo, {
      params: competitionId ? { competitionId } : undefined,
    })
  }
}
