import type { StandingGroup, StandingRow } from '@/domain/entities/Standing'
import { StandingGroupSchema } from '@/infrastructure/validation/schemas'

function getTeam(raw: Record<string, unknown>): { id: number; name: string; badgeUrl?: string } {
  const team = raw.team as Record<string, unknown> | undefined
  if (team?.id != null) {
    return {
      id: team.id as number,
      name: (team.name as string) || '',
      badgeUrl: team.badgeUrl as string | undefined,
    }
  }
  const competitor = raw.competitor as Record<string, unknown> | undefined
  if (competitor?.id != null) {
    return {
      id: competitor.id as number,
      name: (competitor.name as string) || '',
      badgeUrl: competitor.badgeUrl as string | undefined,
    }
  }
  return {
    id: (raw.teamId as number) || 0,
    name: (raw.teamName as string) || '',
    badgeUrl: undefined,
  }
}

export function mapStandingRow(raw: Record<string, unknown>): StandingRow {
  return {
    position: raw.position as number,
    team: getTeam(raw),
    played: (raw.played as number) || (raw.gamesPlayed as number),
    won: (raw.won as number) || (raw.gamesWon as number),
    drawn: (raw.drawn as number) || (raw.gamesEven as number),
    lost: (raw.lost as number) || (raw.gamesLost as number),
    goalsFor: raw.goalsFor as number,
    goalsAgainst: raw.goalsAgainst as number,
    goalDiff: (raw.goalDiff ?? raw.ratio) as number,
    points: raw.points as number,
    recentForm: (raw.recentForm as string[]) || (raw.form as string)?.split('') || [],
  }
}

export function mapStandingGroup(raw: Record<string, unknown>): StandingGroup {
  const parsed = StandingGroupSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  return {
    name: (raw.name as string) || (raw.groupName as string),
    rows: ((raw.rows as Record<string, unknown>[]) || []).map(mapStandingRow),
  }
}

export function mapStandings(raw: Record<string, unknown>[]): StandingGroup[] {
  return raw.map(mapStandingGroup)
}
