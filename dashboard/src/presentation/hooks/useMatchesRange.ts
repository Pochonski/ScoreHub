import { useQuery } from '@tanstack/react-query'
import type { Game } from '@/domain/entities/Game'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapGames } from '@/data/mappers/GameMapper'

export interface MatchesRangeParams {
  /** Día ISO YYYY-MM-DD (se usa como inicio y fin). */
  day: string | null
  competitionId?: number
  all?: boolean
}

/**
 * Partidos de un día vía upstream por rango (vista calendario multi-comp).
 * No depende de la tabla games ni del límite de 20 del endpoint general.
 */
export function useMatchesRange({ day, competitionId, all }: MatchesRangeParams) {
  const { data, isLoading, refetch } = useQuery<Game[]>({
    queryKey: ['matches-range', day, competitionId ?? null, all ?? false],
    enabled: day != null && (all || competitionId != null),
    queryFn: async () => {
      const params: Record<string, string> = { startDate: day as string, endDate: day as string }
      if (all) params.all = 'true'
      else if (competitionId != null) params.competitionId = String(competitionId)
      const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.matchesRange, { params })
      try {
        return mapGames(raw ?? [])
      } catch {
        return []
      }
    },
    staleTime: 60 * 1000,
  })

  return {
    games: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

/** Convierte offset de día (0 = hoy) a ISO YYYY-MM-DD local. */
export function offsetToISODate(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
