import type { News } from '@/domain/entities/News'

export interface NewsRepository {
  getNews(limit?: number, scope?: string, competitionId?: number): Promise<News[]>
  getNewsByGame(gameId: number): Promise<News[]>
}
