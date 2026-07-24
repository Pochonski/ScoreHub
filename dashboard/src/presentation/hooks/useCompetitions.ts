import { useQuery } from '@tanstack/react-query'
import type { Competition, CompetitionDetail } from '@/domain/entities/Competition'
import { DiContainer } from '@/infrastructure/di/DiContainer'

/**
 * TanStack Query migrations. External shapes PRESERVED so consumers don't
 * have to change:
 *  - useCompetitions()        -> { competitions, loading, error, refetch }
 *  - useFeaturedCompetitions() -> { competitions, loading, refetch }
 *  - useCompetitionDetail(id)  -> { detail, loading, refetch }
 */

export function useCompetitions() {
  const { data, isLoading, error, refetch } = useQuery<Competition[]>({
    queryKey: ['competitions', 'all'] as const,
    queryFn: async () => {
      const repo = DiContainer.getInstance().getCompetitionRepository()
      return repo.getCompetitions()
    },
    staleTime: 5 * 60 * 1000,
  })
  const errMsg = error instanceof Error ? error.message : null
  return {
    competitions: data ?? [],
    loading: isLoading,
    error: errMsg,
    refetch: () => refetch(),
  }
}

export function useFeaturedCompetitions() {
  const { data, isLoading, refetch } = useQuery<Competition[]>({
    queryKey: ['competitions', 'featured'] as const,
    queryFn: async () => {
      const repo = DiContainer.getInstance().getCompetitionRepository()
      return repo.getFeaturedCompetitions()
    },
    staleTime: 5 * 60 * 1000,
  })
  return {
    competitions: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useCompetitionDetail(id: number | null) {
  const { data, isLoading, refetch } = useQuery<CompetitionDetail | null>({
    queryKey: ['competition', 'detail', id] as const,
    queryFn: async () => {
      if (!id) return null
      const repo = DiContainer.getInstance().getCompetitionRepository()
      return repo.getCompetitionById(id)
    },
    enabled: id != null,
    staleTime: 60 * 1000,
  })
  return {
    detail: data ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
