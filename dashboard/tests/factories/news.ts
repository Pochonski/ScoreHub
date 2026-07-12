import type { News } from '@/domain/entities/News'

export function createMockNews(overrides: Partial<News> = {}): News {
  return {
    id: 'news-1',
    title: 'Noticia de prueba',
    url: 'https://example.com/news/1',
    publishDate: new Date().toISOString(),
    sourceId: 1,
    image: null,
    gameId: null,
    ...overrides,
  }
}
