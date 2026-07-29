import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import { HeroMatch } from '@/presentation/components/hero/HeroMatch'
import { MatchTicker } from '@/presentation/components/matches/MatchTicker'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { CompetitionInfoCard } from '@/presentation/components/competition/CompetitionInfoCard'
import { MatchFilterBar } from '@/presentation/components/matches/MatchFilterBar'
import { useFeaturedGame, useLiveGames, useGames } from '@/presentation/hooks/useGames'
import { useFeaturedCompetitions } from '@/presentation/hooks/useCompetitions'
import { useActiveCompetition } from '@/presentation/context/ActiveCompetitionContext'
import { ErrorState } from '@/presentation/components/ui/ErrorState'
import { HeroSkeleton, MatchCardSkeleton } from '@/presentation/components/ui/Skeleton'

type FilterValue = 'all' | 'live' | 'upcoming' | 'finished'
type CompetitionScope = { kind: 'all' } | { kind: 'one'; id: number }

const PRIMARY_COMPETITION_ID = parseInt(
  import.meta.env.VITE_PRIMARY_COMPETITION_ID || '5930',
  10
)

export function DashboardPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterValue>('all')
  const [dateOffset, setDateOffset] = useState<number | null>(null)
  const { competitionId: activeCompIdFromCtx, setCompetitionId: setActiveCompId } = useActiveCompetition()
  // Inicializar scope desde el context (si hay), sino Mundial como default.
  const [scope, setScopeState] = useState<CompetitionScope>(() =>
    activeCompIdFromCtx != null
      ? { kind: 'one', id: activeCompIdFromCtx }
      : { kind: 'one', id: PRIMARY_COMPETITION_ID }
  )
  const setScope = (next: CompetitionScope) => {
    setScopeState(next)
    // Sincronizar con el context global: 'all' → null, 'one' → id.
    if (next.kind === 'all') {
      setActiveCompId(null)
    } else {
      setActiveCompId(next.id)
    }
  }
  const { competitions: featured } = useFeaturedCompetitions()

  // Si el backend aún no tiene featured y el default es primary, mantenemos.
  // Si hay varias featured, dejamos la primary fija y "Todas" como alternativa.
  const featuredSorted = useMemo(
    () => [...featured].sort((a, b) => a.displayOrder - b.displayOrder),
    [featured]
  )

  const competitionParam = scope.kind === 'all' ? { all: true } : { competitionId: scope.id }
  const liveParams = scope.kind === 'all' ? { all: true } : { competitionId: scope.id }

  const { game: featuredGame, loading: featuredLoading, refetch: refetchFeatured } =
    useFeaturedGame(scope.kind === 'one' ? scope.id : undefined)
  const { games: liveGames, error: liveError, refetch: refetchLive } = useLiveGames(liveParams)
  const { games: allGames, loading: gamesLoading, error: gamesError, refetch: refetchGames } =
    useGames(competitionParam)
  const [heroCompact, setHeroCompact] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (liveGames.length === 0) return
    let intervalId: ReturnType<typeof setInterval>

    const startPolling = () => {
      intervalId = setInterval(() => {
        refetchFeatured()
        refetchLive()
      }, 30000)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(intervalId)
      } else {
        refetchFeatured()
        refetchLive()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [liveGames.length, refetchFeatured, refetchLive])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setHeroCompact(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: '-56px 0px 0px 0px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [featuredGame?.id])

  const gamesByDateOffset = useMemo(() => {
    if (dateOffset == null) return allGames
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + dateOffset)
    return allGames.filter((g) => {
      if (!g.startTime) return false
      const gameDate = new Date(g.startTime)
      return (
        gameDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
        gameDate.getUTCMonth() === targetDate.getUTCMonth() &&
        gameDate.getUTCDate() === targetDate.getUTCDate()
      )
    })
  }, [allGames, dateOffset])

  const filteredGames = useMemo(() => {
    if (filter === 'all') return gamesByDateOffset
    return gamesByDateOffset.filter((g) => g.status === filter)
  }, [gamesByDateOffset, filter])

  // Cabecera de competición del grid (resuelve el bug del título "Copa
  // Mundial" hardcoded en MatchGrid). 'Todas' usa un nombre genérico.
  const competitionHeaderName = useMemo(() => {
    if (scope.kind === 'all') return 'Todas las competiciones'
    // Después de este guard, TypeScript no siempre estrecha el tipo en
    // closures de useMemo. Usamos un cast explícito al tipo discriminado.
    const oneScope = scope as Extract<CompetitionScope, { kind: 'one' }>
    const targetId = oneScope.id
    const found = featuredSorted.find(c => c.id === targetId)
    if (found) return found.shortName || found.displayName
    return `Competición #${targetId}`
  }, [scope, featuredSorted])

  // Siempre ASC para que las fechas vayan del más antiguo al más reciente
  // (lectura natural de una temporada). Si hay upcoming, los próximos
  // aparecen primero porque tienen fechas futuras.
  const gridDateOrder: 'asc' | 'desc' = 'asc'

  const filterCounts = useMemo(
    () => ({
      all: allGames.length,
      live: liveGames.length,
      upcoming: allGames.filter((g) => g.status === 'upcoming').length,
      finished: allGames.filter((g) => g.status === 'finished').length,
    }),
    [allGames, liveGames.length]
  )

  const handleSelectGame = useCallback(
    async (game: Game) => {
      navigate(`/partido/${game.id}`)
    },
    [navigate]
  )

  const handleScopeChange = (next: CompetitionScope) => {
    setScope(next)
    setFilter('all')
    setDateOffset(null)
  }

  if (gamesError && allGames.length === 0 && liveGames.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ErrorState message={gamesError} onRetry={refetchGames} fullPage />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      {heroCompact && featuredGame && (
        <div className="fixed top-14 right-0 left-0 z-40 lg:hidden">
          <HeroMatch game={featuredGame} compact />
        </div>
      )}

      <section aria-label="Partido destacado" ref={heroRef}>
        {featuredLoading ? <HeroSkeleton /> : featuredGame ? <HeroMatch game={featuredGame} /> : null}
      </section>

      {liveGames.length > 0 && (
        <div className="mt-1 flex justify-end px-4" aria-live="polite" aria-atomic="true" role="status">
          <span className="text-text-dim flex items-center gap-1.5 font-mono text-[10px]">
            <span className="bg-accent-live/60 h-1.5 w-1.5 animate-pulse rounded-full" />
            Actualizando cada 30s
          </span>
        </div>
      )}

      {/* Live ticker */}
      {liveGames.length > 0 && (
        <div className="mt-4 px-4">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="font-display text-text-primary text-lg font-semibold">
              En Vivo
              <span className="text-text-muted font-body ml-2 text-sm font-normal">({liveGames.length})</span>
            </h2>
          </div>
          <MatchTicker games={liveGames} featuredId={featuredGame?.id} onSelect={handleSelectGame} />
        </div>
      )}

      {/* Competition info card (cabecera "tournament info" de la comp activa) */}
      {scope.kind === 'one' && scope.id && (
        <div className="px-4">
          <CompetitionInfoCard competitionId={scope.id} />
        </div>
      )}

      {liveError && (
        <div className="mt-2 px-4">
          <p className="text-accent-red font-mono text-[10px]">{liveError}</p>
        </div>
      )}

      {/* Match Grid */}
      <div className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-text-primary text-lg font-semibold">Partidos</h2>
          <button
            onClick={() => navigate('/analisis')}
            className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded px-1 py-0.5 text-xs transition-colors"
          >
            Análisis →
          </button>
        </div>

        {/* Competition tabs */}
        {featuredSorted.length > 0 && (
          <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleScopeChange({ kind: 'one', id: PRIMARY_COMPETITION_ID })}
              className={`font-body focus-visible shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                scope.kind === 'one' && scope.id === PRIMARY_COMPETITION_ID
                  ? 'bg-accent-gold/10 text-accent-gold'
                  : 'bg-bg-card text-text-muted hover:text-text-primary'
              }`}
            >
              {featuredSorted.find(c => c.id === PRIMARY_COMPETITION_ID)?.shortName ||
                featuredSorted[0]?.shortName ||
                'Principal'}
            </button>
            {featuredSorted
              .filter(c => c.id !== PRIMARY_COMPETITION_ID)
              .map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleScopeChange({ kind: 'one', id: c.id })}
                  className={`font-body focus-visible shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    scope.kind === 'one' && scope.id === c.id
                      ? 'bg-accent-gold/10 text-accent-gold'
                      : 'bg-bg-card text-text-muted hover:text-text-primary'
                  }`}
                >
                  {c.shortName || c.displayName}
                </button>
              ))}
            {featuredSorted.length > 1 && (
              <button
                type="button"
                onClick={() => handleScopeChange({ kind: 'all' })}
                className={`font-body focus-visible shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  scope.kind === 'all'
                    ? 'bg-accent-gold/10 text-accent-gold'
                    : 'bg-bg-card text-text-muted hover:text-text-primary'
                }`}
              >
                Todas
              </button>
            )}
          </div>
        )}

        <div className="mb-4">
          <MatchFilterBar
            active={filter}
            counts={filterCounts}
            onChange={setFilter}
            dateOffset={dateOffset}
            onDateChange={setDateOffset}
          />
        </div>

        {gamesLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : gamesError ? (
          <div className="px-4 py-8">
            <ErrorState message={gamesError} onRetry={refetchGames} />
          </div>
        ) : (
          <MatchGrid
            games={filteredGames}
            onSelect={handleSelectGame}
            featuredId={featuredGame?.id}
            competitionName={competitionHeaderName}
            competitionId={scope.kind === 'one' ? scope.id : undefined}
            dateOrder={gridDateOrder}
          />
        )}
      </div>
    </div>
  )
}
