import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

export interface PlayByPlayPlayer {
  name: string | null
  shortName: string | null
  athleteId: number | null
  jersey: number | null
}

export interface PlayByPlayMessage {
  minute: number | null
  type: string | null
  title: string | null
  comment: string
  isMajor: boolean
  team: number | null
  period: string | null
  players: PlayByPlayPlayer[]
}

/**
 * Relato en vivo jugada a jugada. Pollea cada 30s solo en partidos en vivo;
 * en finalizados/con próximos hace un único fetch (el relato queda fijo).
 */
export function useMatchPlayByPlay(gameId: number | null, live: boolean) {
  const { data, isLoading, refetch } = useQuery<PlayByPlayMessage[]>({
    queryKey: ['match-playbyplay', gameId],
    enabled: gameId != null,
    queryFn: async () => {
      const r = await apiClient.get<PlayByPlayMessage[]>(ENDPOINTS.matchPlayByPlay(gameId as number))
      return r ?? []
    },
    staleTime: 30 * 1000,
    refetchInterval: live ? 30 * 1000 : false,
  })

  return {
    messages: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}
