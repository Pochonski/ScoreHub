import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapAthlete, mapAthletes } from '@/data/mappers/AthleteMapper'
import type { AthleteRepository } from '@/domain/repositories/AthleteRepository'
import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'

export class ApiAthleteRepository implements AthleteRepository {
  async searchAthletes(query: string, teamId?: number): Promise<Athlete[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.athletes, {
      params: { search: query, teamId: teamId?.toString() },
    })
    return mapAthletes(raw)
  }

  async getAthleteById(id: number): Promise<Athlete | null> {
    const raw = await apiClient.get<Record<string, unknown> | null>(ENDPOINTS.athleteById(id))
    return raw ? mapAthlete(raw) : null
  }

  async getAthleteCareer(id: number): Promise<AthleteCareerSeason[]> {
    return apiClient.get<AthleteCareerSeason[]>(ENDPOINTS.athleteCareer(id))
  }

  async getAthleteTrophies(id: number): Promise<AthleteTrophyCategory[]> {
    return apiClient.get<AthleteTrophyCategory[]>(ENDPOINTS.athleteTrophies(id))
  }

  async getAthleteTransfers(id: number): Promise<AthleteTransfer[]> {
    return apiClient.get<AthleteTransfer[]>(ENDPOINTS.athleteTransfers(id))
  }
}
