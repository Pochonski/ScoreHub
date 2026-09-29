import type { Game, GameStatus, GameStatusGroup } from '@/domain/entities/Game'
import type { RawGame } from '@/domain/entities/RawGame'
import { GameSchema, GameArraySchema } from '@/infrastructure/validation/schemas'
import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'

const STATUS_MAP: Record<GameStatusGroup, GameStatus> = {
  1: 'live',
  2: 'upcoming',
  // 3 = primer tiempo (en juego según 365scores) → live, no upcoming.
  3: 'live',
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
    competitionId: typeof raw.competitionId === 'number' ? raw.competitionId : undefined,
    statusGroup: d.statusGroup as GameStatusGroup,
    status: mapGameStatus(d.statusGroup as GameStatusGroup),
    stage: (raw.stageName as string) || '',
    stageName: d.stage || '',
    groupNum: typeof raw.groupNum === 'number' ? raw.groupNum : undefined,
    startTime: d.startTime || '',
    homeTeam: {
      id: ht?.id ?? ((raw.homeTeam as Record<string, unknown>)?.id as number),
      name: ht?.name || ((raw.homeTeam as Record<string, unknown>)?.name as string) || '',
      shortName: ht?.name || ((raw.homeTeam as Record<string, unknown>)?.shortName as string),
      score: ht?.score ?? undefined,
      badgeUrl: (raw.homeTeam as Record<string, unknown>)?.badgeUrl as string,
      flagUrl: (raw.homeTeam as Record<string, unknown>)?.flagUrl as string | undefined,
    },
    awayTeam: {
      id: at?.id ?? ((raw.awayTeam as Record<string, unknown>)?.id as number),
      name: at?.name || ((raw.awayTeam as Record<string, unknown>)?.name as string) || '',
      shortName: at?.name || ((raw.awayTeam as Record<string, unknown>)?.shortName as string),
      score: at?.score ?? undefined,
      badgeUrl: (raw.awayTeam as Record<string, unknown>)?.badgeUrl as string,
      flagUrl: (raw.awayTeam as Record<string, unknown>)?.flagUrl as string | undefined,
    },
    statusText: (raw.statusText as string) || undefined,
    minute: (raw.minute as number) || undefined,
    officials: Array.isArray(raw.officials)
      ? (raw.officials as unknown[]).filter((o): o is string => typeof o === 'string' && o.length > 0)
      : undefined,
    hasPlayByPlay: raw.hasPlayByPlay === true,
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

/**
 * Convierte el shape crudo upstream (homeCompetitor/awayCompetitor,
 * scores[], statusGroup numérico) al entity Game. Los scores < 0 (-1 =
 * desconocido) se tratan como sin marcador.
 */
export function mapRawGame(raw: RawGame): Game {
  const sg: GameStatusGroup =
    raw.statusGroup === 1 || raw.statusGroup === 2 || raw.statusGroup === 3 || raw.statusGroup === 4
      ? raw.statusGroup
      : 2
  const [homeScore, awayScore] = raw.scores ?? []
  const score = (v: number | undefined) => (typeof v === 'number' && v >= 0 ? v : undefined)
  return {
    id: raw.id,
    competitionId: raw.competitionId,
    statusGroup: sg,
    status: mapGameStatus(sg),
    stage: raw.stageName || raw.roundName || '',
    stageName: raw.stageName || '',
    groupNum: raw.groupNum,
    startTime: raw.startTime,
    homeTeam: {
      id: raw.homeCompetitor.id,
      name: raw.homeCompetitor.name,
      shortName: raw.homeCompetitor.shortName || raw.homeCompetitor.symbolicName,
      score: score(homeScore),
      badgeUrl: raw.homeCompetitor.badgeUrl,
    },
    awayTeam: {
      id: raw.awayCompetitor.id,
      name: raw.awayCompetitor.name,
      shortName: raw.awayCompetitor.shortName || raw.awayCompetitor.symbolicName,
      score: score(awayScore),
      badgeUrl: raw.awayCompetitor.badgeUrl,
    },
    statusText: raw.statusText || undefined,
    minute: raw.gameTime ?? undefined,
  }
}
