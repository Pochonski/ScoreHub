import { useQuery } from '@tanstack/react-query'
import type { Game } from '@/domain/entities/Game'
import type { Trend } from '@/domain/entities/BettingTip'
import type { Prediction } from '@/domain/entities/Prediction'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { mapGames, mapGame } from '@/data/mappers/GameMapper'

export interface PreviewFormEntry {
  gameId: number
  result: 'W' | 'D' | 'L'
  scoreFor: number
  scoreAgainst: number
  startTime: string
  game: Game
}

export interface PreviewTableRow {
  position: number | null
  played: number | null
  won: number | null
  drawn: number | null
  lost: number | null
  points: number | null
}

export interface MatchPreview {
  gameId: number
  competitionId: number
  homeTeamId: number
  awayTeamId: number
  game: Game | null
  form: { home: PreviewFormEntry[]; away: PreviewFormEntry[] }
  h2h: { h2hGames: Game[]; homeRecent: Game[]; awayRecent: Game[] }
  table: { home: PreviewTableRow | null; away: PreviewTableRow | null }
  trends: Trend[]
  predictions: Prediction[]
}

interface RawPreview {
  gameId: number
  competitionId: number
  homeTeamId: number
  awayTeamId: number
  form: {
    home: Array<Omit<PreviewFormEntry, 'game'> & { game: Record<string, unknown> }>
    away: Array<Omit<PreviewFormEntry, 'game'> & { game: Record<string, unknown> }>
  }
  h2h: {
    h2hGames: Record<string, unknown>[]
    homeRecent: Record<string, unknown>[]
    awayRecent: Record<string, unknown>[]
  }
  table: { home: PreviewTableRow | null; away: PreviewTableRow | null }
  trends: Trend[]
  predictions: Prediction[]
}

/**
 * Previa de un partido en 1 request (bundle /matches/:id/preview).
 * Incluye H2H, forma reciente, filas de tabla, tendencias y predicciones.
 */
export function useMatchPreview(gameId: number | null) {
  const { data, isLoading, error, refetch } = useQuery<MatchPreview | null>({
    queryKey: ['match-preview', gameId],
    enabled: gameId != null,
    queryFn: async () => {
      const raw = await apiClient.get<RawPreview>(ENDPOINTS.matchPreview(gameId as number))
      if (!raw) return null
      const mapForm = (
        list: RawPreview['form']['home']
      ): PreviewFormEntry[] =>
        list.map((e) => ({ ...e, game: mapGame(e.game) })).filter((e) => e.game) as PreviewFormEntry[]
      // Juego base: se resuelve aparte (el bundle no lo incluye para no duplicar).
      const base = await apiClient
        .get<Record<string, unknown> | null>(ENDPOINTS.matchById(gameId as number))
        .catch(() => null)
      return {
        gameId: raw.gameId,
        competitionId: raw.competitionId,
        homeTeamId: raw.homeTeamId,
        awayTeamId: raw.awayTeamId,
        game: base ? mapGame(base) : null,
        form: { home: mapForm(raw.form.home), away: mapForm(raw.form.away) },
        h2h: {
          h2hGames: mapGames(raw.h2h.h2hGames),
          homeRecent: mapGames(raw.h2h.homeRecent),
          awayRecent: mapGames(raw.h2h.awayRecent),
        },
        table: raw.table,
        trends: raw.trends ?? [],
        predictions: raw.predictions ?? [],
      }
    },
    staleTime: 60 * 1000,
  })

  return {
    preview: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: () => refetch(),
  }
}
