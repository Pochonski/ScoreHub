import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import type { CompetitionRepository } from '@/domain/repositories/CompetitionRepository'
import type { Competition, CompetitionDetail } from '@/domain/entities/Competition'

export class ApiCompetitionRepository implements CompetitionRepository {
  async getCompetitions(): Promise<Competition[]> {
    return apiClient.get<Competition[]>(ENDPOINTS.competitions)
  }

  async getFeaturedCompetitions(): Promise<Competition[]> {
    return apiClient.get<Competition[]>(ENDPOINTS.competitionsFeatured)
  }

  async getCompetitionById(id: number): Promise<CompetitionDetail | null> {
    return apiClient.get<CompetitionDetail | null>(ENDPOINTS.competitionById(id))
  }

  async getCompetitionSeasons(id: number): Promise<CompetitionDetail['seasons']> {
    return apiClient.get<CompetitionDetail['seasons']>(ENDPOINTS.competitionSeasons(id))
  }
}
