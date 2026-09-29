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

/**
 * Mapear nextMatch del upstream (viene en cada row de standings).
 * `homeCompetitor` siempre trae el local, `awayCompetitor` el visitante.
 * Si el equipo de esta fila es `homeCompetitor.id`, `isHome=true`.
 */
function mapNextMatch(raw: Record<string, unknown>, teamId: number): StandingRow['nextMatch'] {
  const nm = raw.nextMatch as Record<string, unknown> | undefined
  if (!nm || !nm.id) return undefined
  const home = nm.homeCompetitor as Record<string, unknown> | undefined
  const away = nm.awayCompetitor as Record<string, unknown> | undefined
  const isHome = home?.id === teamId
  const opp = isHome ? away : home
  if (!opp) return undefined
  return {
    id: Number(nm.id),
    startTime: (nm.startTime as string) || undefined,
    isHome,
    roundNum: nm.roundNum as number | undefined,
    competitionDisplayName: nm.competitionDisplayName as string | undefined,
    opponent: {
      id: Number(opp.id),
      name: (opp.name as string) || '',
      badgeUrl: opp.badgeUrl as string | undefined,
    },
  }
}

export function mapStandingRow(raw: Record<string, unknown>): StandingRow {
  const team = getTeam(raw)
  return {
    position: raw.position as number,
    team,
    played: (raw.played as number) || (raw.gamesPlayed as number),
    won: (raw.won as number) || (raw.gamesWon as number),
    drawn: (raw.drawn as number) || (raw.gamesEven as number),
    lost: (raw.lost as number) || (raw.gamesLost as number),
    goalsFor: raw.goalsFor as number,
    goalsAgainst: raw.goalsAgainst as number,
    goalDiff: (raw.goalDiff ?? raw.ratio) as number,
    points: raw.points as number,
    recentForm: (raw.recentForm as string[]) || (raw.form as string)?.split('') || [],
    trend: typeof raw.trend === 'number' ? raw.trend : undefined,
    hasPointsDeduction: raw.hasPointsDeduction === true,
    nextMatch: mapNextMatch(raw, team.id),
  }
}

export function mapStandingGroup(raw: Record<string, unknown>): StandingGroup {
  const parsed = StandingGroupSchema.safeParse(raw)
  if (parsed.success) {
    return {
      ...parsed.data,
      displayName: (raw.displayName as string) || parsed.data.name,
      isCurrentStage: raw.isCurrentStage as boolean | undefined,
      // Las filas SIEMPRE se mapean a mano: zod elimina trend, nextMatch y
      // hasPointsDeduction, que la entidad sí declara.
      rows: ((raw.rows as Record<string, unknown>[]) || []).map(mapStandingRow),
    }
  }

  return {
    name: (raw.name as string) || (raw.groupName as string),
    displayName: raw.displayName as string | undefined,
    isCurrentStage: raw.isCurrentStage as boolean | undefined,
    rows: ((raw.rows as Record<string, unknown>[]) || []).map(mapStandingRow),
  }
}

export function mapStandings(raw: Record<string, unknown>[]): StandingGroup[] {
  return raw.map(mapStandingGroup)
}
