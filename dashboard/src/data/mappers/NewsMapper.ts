import type { News } from '@/domain/entities/News'
import { NewsSchema } from '@/infrastructure/validation/schemas'
import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'

export function mapNews(raw: Record<string, unknown>): News {
  const parsed = NewsSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError('News data validation failed', ErrorCode.VALIDATION_ERROR)
  }
  if (typeof raw.url !== 'string' || raw.url.trim() === '') {
    throw new AppError('News data validation failed', ErrorCode.VALIDATION_ERROR)
  }

  return {
    id: String(raw.id),
    title: raw.title as string,
    publishDate: raw.publishDate as string,
    image: (raw.image as string) || undefined,
    url: raw.url as string,
    sourceId: (raw.sourceId as number) || undefined,
    gameId: (raw.gameId as number) || undefined,
  }
}

export function mapNewsList(raw: Record<string, unknown>[]): News[] {
  if (!Array.isArray(raw)) {
    throw new AppError('News list validation failed', ErrorCode.VALIDATION_ERROR)
  }
  // Tolerante por item: una noticia rota (URL relativa, sin título) se
  // descarta sin tumbar toda la lista.
  const out: News[] = []
  for (const item of raw) {
    try {
      out.push(mapNews(item))
    } catch {
      continue
    }
  }
  return out
}
