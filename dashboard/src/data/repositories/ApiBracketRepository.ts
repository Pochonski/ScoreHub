import type { BracketStage } from '@/domain/entities/Bracket'
import type { BracketRepository } from '@/domain/repositories/BracketRepository'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

export class ApiBracketRepository implements BracketRepository {
  async getBrackets(): Promise<BracketStage[]> {
    return apiClient.get<BracketStage[]>(ENDPOINTS.brackets)
  }
}
