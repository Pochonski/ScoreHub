import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapStandings } from '@/data/mappers/StandingMapper'
import type { StandingRepository } from '@/domain/repositories/StandingRepository'
import type { StandingGroup } from '@/domain/entities/Standing'
import type { BracketStage } from '@/domain/entities/Bracket'

export class ApiStandingRepository implements StandingRepository {
  async getStandings(competitionId?: number): Promise<StandingGroup[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.standings, {
      params: competitionId ? { competitionId } : undefined,
    })
    return mapStandings(raw)
  }

  async getBrackets(competitionId?: number): Promise<BracketStage[]> {
    return apiClient.get<BracketStage[]>(ENDPOINTS.brackets, {
      params: competitionId ? { competitionId } : undefined,
    })
  }
}
