import type { Game, GameStatus, GameStatusGroup } from '@/domain/entities/Game'
import { GameSchema, GameArraySchema } from '@/infrastructure/validation/schemas'
import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'

const STATUS_MAP: Record<GameStatusGroup, GameStatus> = {
  1: 'live',
  2: 'upcoming',
  3: 'upcoming',
  4: 'finished',
}

export function mapGameStatus(group: GameStatusGroup): GameStatus {
  return STATUS_MAP[group] || 'upcoming'
}

export function mapGame(raw: Record<string, unknown>): Game {
  const parsed = GameSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError('Game data validation failed', ErrorCode.VALIDATION_ERROR)
  }

  const d = parsed.data
  const ht = d.homeTeam
  const at = d.awayTeam

  return {
    id: d.id,
    statusGroup: d.statusGroup as GameStatusGroup,
    status: mapGameStatus(d.statusGroup as GameStatusGroup),
    stage: (raw.stageName as string) || '',
    stageName: d.stage || '',
    groupNum: ((raw.groupNum as number | undefined) ?? d.statusGroup === 2) ? undefined : undefined,
    startTime: d.startTime || '',
    homeTeam: {
      id: ht?.id ?? ((raw.homeTeam as Record<string, unknown>)?.id as number),
      name: ht?.name || ((raw.homeTeam as Record<string, unknown>)?.name as string) || '',
      shortName: ht?.name || ((raw.homeTeam as Record<string, unknown>)?.shortName as string),
      score: ht?.score ?? undefined,
      badgeUrl: (raw.homeTeam as Record<string, unknown>)?.badgeUrl as string,
    },
    awayTeam: {
      id: at?.id ?? ((raw.awayTeam as Record<string, unknown>)?.id as number),
      name: at?.name || ((raw.awayTeam as Record<string, unknown>)?.name as string) || '',
      shortName: at?.name || ((raw.awayTeam as Record<string, unknown>)?.shortName as string),
      score: at?.score ?? undefined,
      badgeUrl: (raw.awayTeam as Record<string, unknown>)?.badgeUrl as string,
    },
    statusText: (raw.statusText as string) || undefined,
    minute: (raw.minute as number) || undefined,
    events: raw.events as Game['events'],
    stats: raw.stats as Game['stats'],
  }
}

export function mapGames(raw: Record<string, unknown>[]): Game[] {
  const parsed = GameArraySchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError('Game list validation failed', ErrorCode.VALIDATION_ERROR)
  }
  return raw.map(mapGame)
}
