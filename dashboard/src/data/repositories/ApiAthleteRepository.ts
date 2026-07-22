import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapAthlete, mapAthletes } from '@/data/mappers/AthleteMapper'
import type { AthleteRepository, RepoOptions } from '@/domain/repositories/AthleteRepository'
import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'

export class ApiAthleteRepository implements AthleteRepository {
  async searchAthletes(query: string, teamId?: number, options?: RepoOptions): Promise<Athlete[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.athletes, {
      params: { search: query, teamId: teamId?.toString() },
      signal: options?.signal,
    })
    return mapAthletes(raw)
  }

  async getAthleteById(id: number, options?: RepoOptions): Promise<Athlete | null> {
    try {
      const raw = await apiClient.get<Record<string, unknown>>(ENDPOINTS.athleteById(id), {
        signal: options?.signal,
      })
      return raw ? mapAthlete(raw) : null
    } catch (e) {
      // Surface 404 as null so the hook can render an explicit "not found"
      // state instead of an error boundary.
      if ((e as { code?: string })?.code === 'NOT_FOUND') return null
      throw e
    }
  }

  async getAthleteCareer(id: number, options?: RepoOptions): Promise<AthleteCareerSeason[]> {
    return apiClient.get<AthleteCareerSeason[]>(ENDPOINTS.athleteCareer(id), {
      signal: options?.signal,
    })
  }

  async getAthleteTrophies(id: number, options?: RepoOptions): Promise<AthleteTrophyCategory[]> {
    return apiClient.get<AthleteTrophyCategory[]>(ENDPOINTS.athleteTrophies(id), {
      signal: options?.signal,
    })
  }

  async getAthleteTransfers(id: number, options?: RepoOptions): Promise<AthleteTransfer[]> {
    return apiClient.get<AthleteTransfer[]>(ENDPOINTS.athleteTransfers(id), {
      signal: options?.signal,
    })
  }
}