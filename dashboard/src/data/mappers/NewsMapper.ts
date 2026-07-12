import type { News } from '@/domain/entities/News'
import { NewsSchema, NewsArraySchema } from '@/infrastructure/validation/schemas'
import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'

export function mapNews(raw: Record<string, unknown>): News {
  const parsed = NewsSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError('News data validation failed', ErrorCode.VALIDATION_ERROR)
  }

  return {
    id: raw.id as string,
    title: raw.title as string,
    publishDate: raw.publishDate as string,
    image: (raw.image as string) || undefined,
    url: raw.url as string,
    sourceId: (raw.sourceId as number) || undefined,
    gameId: (raw.gameId as number) || undefined,
  }
}

export function mapNewsList(raw: Record<string, unknown>[]): News[] {
  const parsed = NewsArraySchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError('News list validation failed', ErrorCode.VALIDATION_ERROR)
  }
  return raw.map(mapNews)
}
