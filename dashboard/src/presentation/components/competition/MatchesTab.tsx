import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { MatchCardSkeleton } from '@/presentation/components/ui/Skeleton'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

const PAGE_SIZE = 20

type MatchesFilter = 'finished' | 'upcoming' | 'live'

const FILTERS: { id: MatchesFilter; label: string; statusGroup: string }[] = [
  { id: 'finished', label: 'Anteriores', statusGroup: '4' },
  { id: 'upcoming', label: 'Próximos', statusGroup: '2' },
  { id: 'live', label: 'En vivo', statusGroup: '1' },
]

const EMPTY_MESSAGES: Record<MatchesFilter, string> = {
  finished: 'Sin partidos anteriores registrados',
  upcoming: 'Sin próximos partidos programados',
  live: 'Sin partidos en vivo ahora mismo',
}

/**
 * MatchesTab — partidos de una competición con filtros por estado.
 * Respeta el seasonNum del SeasonSelector (número, 'all' o undefined).
 * Paginación acumulativa (límite creciente) como useNews.
 */
export function MatchesTab({
  competitionId,
  seasonNum,
}: {
  competitionId: number
  seasonNum?: number | 'all'
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<MatchesFilter>('finished')
  const [extraPages, setExtraPages] = useState(0)

  const statusGroup = FILTERS.find((f) => f.id === filter)!.statusGroup
  const limit = (extraPages + 1) * PAGE_SIZE

  const qKey = ['comp-matches', competitionId, seasonNum ?? null, filter, limit] as const
  const { data, isLoading, error, refetch } = useQuery<Game[]>({
    queryKey: qKey,
    queryFn: async () => {
      const gameRepo = DiContainer.getInstance().getGameRepository()
      return gameRepo.getGames({ competitionId, statusGroup, seasonNum, limit })
    },
    staleTime: filter === 'live' ? 30 * 1000 : 60 * 1000,
  })

  const games = data ?? []
  const hasMore = games.length >= limit

  const handleFilterChange = useCallback((next: MatchesFilter) => {
    setFilter(next)
    setExtraPages(0)
  }, [])

  const handleSelect = useCallback(
    (game: Game) => navigate(`/partido/${game.id}`),
    [navigate]
  )

  if (error) {
    return <ErrorState message={error instanceof Error ? error.message : String(error)} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="no-scrollbar bg-bg-card border-border-card inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleFilterChange(f.id)}
              className={`font-body focus-visible shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                filter === f.id
                  ? 'bg-accent-gold/10 text-accent-gold shadow-sm'
                  : 'text-text-muted hover:bg-bg-elevated/50 hover:text-text-primary'
              }`}
              aria-pressed={filter === f.id}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && games.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <MatchGrid
            games={games}
            onSelect={handleSelect}
            competitionId={competitionId}
            emptyMessage={EMPTY_MESSAGES[filter]}
            dateOrder={filter === 'upcoming' ? 'asc' : 'desc'}
          />
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setExtraPages((p) => p + 1)}
                className="font-body bg-bg-card border-border-card text-text-muted hover:text-accent-gold hover:border-border-hover focus-visible rounded-xl border px-6 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Cargar más partidos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
