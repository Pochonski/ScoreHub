import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapNewsList } from '@/data/mappers/NewsMapper'
import type { NewsRepository } from '@/domain/repositories/NewsRepository'
import type { News } from '@/domain/entities/News'

export class ApiNewsRepository implements NewsRepository {
  async getNews(limit = 20, scope = 'competition', competitionId?: number): Promise<News[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.news, {
      params: { limit: String(limit), scope, competitionId },
    })
    return mapNewsList(raw)
  }

  async getNewsByGame(gameId: number): Promise<News[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.newsByGame(gameId))
    return mapNewsList(raw)
  }
}
