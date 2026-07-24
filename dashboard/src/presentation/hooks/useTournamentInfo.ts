import { useQuery } from '@tanstack/react-query'
import type { TournamentInfo } from '@/domain/entities/TournamentInfo'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getTournamentInfoRepository()

/**
 * TanStack Query version. External shape preserved:
 * returns { info, loading, refetch }.
 */
export function useTournamentInfo(competitionId?: number | null) {
  const qKey = ['tournament-info', competitionId ?? null] as const

  const { data, isLoading, refetch } = useQuery<TournamentInfo | null>({
    queryKey: qKey,
    queryFn: async () => {
      const d = await repo.getTournamentInfo(competitionId ?? undefined)
      return d ?? null
    },
    staleTime: 60 * 60 * 1000, // 1h — tournament info changes rarely
  })

  return {
    info: data ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
