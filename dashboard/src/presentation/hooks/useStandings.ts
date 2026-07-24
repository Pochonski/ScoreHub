import { useQuery } from '@tanstack/react-query'
import type { StandingGroup } from '@/domain/entities/Standing'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import type { StandingsOptions } from '@/domain/repositories/StandingRepository'

const repo = DiContainer.getInstance().getStandingRepository()

/**
 * TanStack Query version. External shape preserved:
 * returns { groups, loading, error, refetch }.
 */
export function useStandings(competitionId?: number | null, options?: StandingsOptions) {
  const stageNum = options?.stageNum ?? null
  const seasonNum = options?.seasonNum ?? null
  const qKey = ['standings', competitionId ?? null, stageNum, seasonNum] as const

  const { data, isLoading, error, refetch } = useQuery<StandingGroup[]>({
    queryKey: qKey,
    queryFn: async () => repo.getStandings(competitionId ?? undefined, options),
    staleTime: 60 * 1000,
  })

  const errMsg = error instanceof Error ? error.message : null
  return {
    groups: data ?? [],
    loading: isLoading,
    error: errMsg,
    refetch: () => refetch(),
  }
}
