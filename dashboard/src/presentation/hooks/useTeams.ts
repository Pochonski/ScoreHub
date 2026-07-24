import { useQuery } from '@tanstack/react-query'
import type { Team } from '@/domain/entities/Team'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getTeamRepository()

/**
 * TanStack Query versions. External shapes preserved:
 *  - useTeams(nationalOnly?, competitionId?) → { teams, loading, refetch }
 *  - useTeam(id, competitionId?)            → { team, matches, loading, refetch }
 */

export function useTeams(nationalOnly?: boolean, competitionId?: number | null) {
  const qKey = ['teams', nationalOnly ?? false, competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<Team[]>({
    queryKey: qKey,
    queryFn: async () => {
      try {
        return await repo.getTeams(nationalOnly, competitionId ?? undefined)
      } catch {
        return [] as Team[]
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    teams: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useTeam(id: number | null, competitionId?: number | null) {
  const qKey = ['team', id, competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<{ team: Team | null; matches: Game[] }>({
    queryKey: qKey,
    enabled: id != null,
    queryFn: async () => {
      try {
        const tid = id as number
        const [t, m] = await Promise.all([
          repo.getTeamById(tid),
          repo.getTeamMatches(tid, competitionId ?? undefined),
        ])
        return { team: t, matches: m }
      } catch {
        return { team: null, matches: [] as Game[] }
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    team: data?.team ?? null,
    matches: data?.matches ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}
