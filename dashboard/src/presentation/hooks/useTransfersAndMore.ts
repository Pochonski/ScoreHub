import { useQuery } from '@tanstack/react-query'
import type { RawGame } from '@/domain/entities/RawGame'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

// ============================================================================
// Types
// ============================================================================

export interface Transfer {
  id: number
  athleteId: number | null
  athleteName?: string
  athleteShortName?: string
  athleteImageVersion?: number
  originId: number | null
  originName?: string
  targetId: number | null
  targetName?: string
  time: string | null
  price: string | null
  positionId: number | null
  isArrival: boolean
  isDeparture: boolean
  statusId: number | null
  statusName: string | null
  data?: Record<string, unknown>
}

export interface TransferSummary {
  teamId: number
  name: string
  shortName?: string
  badgeUrl?: string | null
  arrivals: number
  departures: number
}

interface SeasonOption {
  seasonNum: number
  seasonName: string
}

interface TeamInfoResult {
  id: number
  name: string
  shortName?: string
  symbolicName?: string
  nameForURL?: string
  countryId?: number
  sportId?: number
  type?: number
  popularityRank?: number
  imageVersion?: number
  color?: string
  awayColor?: string
  mainCompetitionId?: number
  hasSquad?: boolean
  hasTransfers?: boolean
  badgeUrl?: string | null
  seasons?: unknown[]
}

export interface CompetitionInsights {
  trends: { count: number; items: Transfer[] }
  suggestions: { count: number; items: RawGame[] }
  outrights: { available: boolean; updatedAt: string | null; data: unknown }
  topStats: unknown
  teamOfWeek: { available: boolean; updatedAt?: string; formation?: string; players?: unknown[] } | { available: boolean }
  upcoming: { count: number; items: RawGame[] }
}

export interface TrendDetail {
  trend: Record<string, unknown> | null
  games: Array<{ game: RawGame; outcome: number | null; competitionId: number }>
}

/* ============================================================================ */
/* TanStack Query versions. External shapes preserved.                          */
/* ============================================================================ */

export function useCompetitionTransfers(competitionId: number | null, teamId?: number | null) {
  const qKey = ['transfers', competitionId, teamId ?? null] as const
  const { data, isLoading, refetch } = useQuery<Transfer[]>({
    queryKey: qKey,
    enabled: competitionId != null && teamId != null,
    queryFn: async () => {
      const r = await apiClient.get<Transfer[]>(ENDPOINTS.competitionTransfers(competitionId as number), {
        params: { teamId: String(teamId) },
      })
      return r ?? []
    },
    staleTime: 60 * 1000,
  })
  return {
    transfers: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useCompetitionTransfersSummary(competitionId: number | null) {
  const qKey = ['transfers-summary', competitionId] as const
  const { data, isLoading, refetch } = useQuery<TransferSummary[]>({
    queryKey: qKey,
    enabled: competitionId != null,
    queryFn: async () => {
      const r = await apiClient.get<TransferSummary[]>(
        ENDPOINTS.competitionTransfersSummary(competitionId as number)
      )
      return r ?? []
    },
    staleTime: 60 * 1000,
  })
  return {
    summary: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useGameSuggestions(competitionId: number | null) {
  const qKey = ['game-suggestions', competitionId] as const
  const { data, isLoading, refetch } = useQuery<RawGame[]>({
    queryKey: qKey,
    enabled: competitionId != null,
    queryFn: async () => {
      const r = await apiClient.get<RawGame[]>(ENDPOINTS.suggestions, {
        params: { competitionId: String(competitionId) },
      })
      return r ?? []
    },
    staleTime: 60 * 1000,
  })
  return {
    suggestions: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useStandingsSeasons(competitionId: number | null) {
  const qKey = ['standings-seasons', competitionId] as const
  const { data, isLoading, refetch } = useQuery<SeasonOption[]>({
    queryKey: qKey,
    enabled: competitionId != null,
    queryFn: async () => {
      const r = await apiClient.get<SeasonOption[]>(ENDPOINTS.standingsSeasons, {
        params: { competitionId: String(competitionId) },
      })
      return r ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
  return {
    seasons: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useCompetitionInsights(competitionId: number | null) {
  const qKey = ['competition-insights', competitionId] as const
  const { data, isLoading, refetch } = useQuery<CompetitionInsights>({
    queryKey: qKey,
    enabled: competitionId != null,
    queryFn: async () => {
      return apiClient.get<CompetitionInsights>(
        ENDPOINTS.competitionInsights(competitionId as number)
      )
    },
    staleTime: 60 * 1000,
  })
  return {
    insights: data,
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useTeamInfo(teamId: number | null) {
  const qKey = ['team-info', teamId] as const
  const { data, isLoading, refetch } = useQuery<TeamInfoResult>({
    queryKey: qKey,
    enabled: teamId != null,
    queryFn: async () => {
      const d = await apiClient.get<TeamInfoResult>(ENDPOINTS.teamInfo(teamId as number))
      return d ?? null
    },
    staleTime: 60 * 1000,
  })
  return {
    info: data ?? null,
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useTeamRecentForm(teamId: number | null, numOfGames = 5) {
  const qKey = ['team-recent-form', teamId, numOfGames] as const
  const { data, isLoading, refetch } = useQuery<RawGame[]>({
    queryKey: qKey,
    enabled: teamId != null,
    queryFn: async () => {
      const r = await apiClient.get<RawGame[]>(ENDPOINTS.teamRecentForm(teamId as number), {
        params: { numOfGames: String(numOfGames) },
      })
      return r ?? []
    },
    staleTime: 60 * 1000,
  })
  return {
    games: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useTeamUpcoming(teamId: number | null) {
  const qKey = ['team-upcoming', teamId] as const
  const { data, isLoading, refetch } = useQuery<RawGame[]>({
    queryKey: qKey,
    enabled: teamId != null,
    queryFn: async () => {
      const r = await apiClient.get<RawGame[]>(ENDPOINTS.teamUpcoming(teamId as number))
      return r ?? []
    },
    staleTime: 60 * 1000,
  })
  return {
    games: data ?? [],
    loading: isLoading,
    refetch: () => refetch(),
  }
}

export function useTrendDetails(trendId: number | null) {
  const qKey = ['trend-details', trendId] as const
  const { data, isLoading, refetch } = useQuery<TrendDetail>({
    queryKey: qKey,
    enabled: trendId != null,
    queryFn: async () => {
      return apiClient.get<TrendDetail>(ENDPOINTS.trendDetails, {
        params: { trendId: String(trendId) },
      })
    },
    staleTime: 60 * 1000,
  })
  return {
    detail: data,
    loading: isLoading,
    refetch: () => refetch(),
  }
}
