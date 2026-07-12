import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import { HeroMatch } from '@/presentation/components/hero/HeroMatch'
import { MatchTicker } from '@/presentation/components/matches/MatchTicker'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { MatchFilterBar } from '@/presentation/components/matches/MatchFilterBar'
import { useFeaturedGame, useLiveGames, useGames } from '@/presentation/hooks/useGames'
import { ErrorState } from '@/presentation/components/ui/ErrorState'
import { HeroSkeleton, MatchCardSkeleton } from '@/presentation/components/ui/Skeleton'

type FilterValue = 'all' | 'live' | 'upcoming' | 'finished'

export function DashboardPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterValue>('all')
  const [dateOffset, setDateOffset] = useState<number | null>(null)
  const { game: featuredGame, loading: featuredLoading, refetch: refetchFeatured } = useFeaturedGame()
  const { games: liveGames, loading: liveLoading, error: liveError, refetch: refetchLive } = useLiveGames()
  const { games: allGames, loading: gamesLoading, error: gamesError, refetch: refetchGames } = useGames()
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
        {featuredLoading ? (
          <div className="px-4 py-6 sm:py-8 md:py-12">
            <HeroSkeleton />
          </div>
        ) : featuredGame ? (
          <HeroMatch game={featuredGame} />
        ) : null}
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

      {liveError && (
        <div className="mt-2 px-4">
          <p className="text-accent-red font-mono text-[10px]">{liveError}</p>
        </div>
      )}

      {/* Match Grid */}
      <div className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-text-primary text-lg font-semibold">Partidos</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/analisis')}
              className="font-body text-accent-blue hover:text-accent-blue/80 text-xs transition-colors"
            >
              Análisis →
            </button>
            <MatchFilterBar
              active={filter}
              counts={filterCounts}
              onChange={setFilter}
              dateOffset={dateOffset}
              onDateChange={setDateOffset}
            />
          </div>
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
          <MatchGrid games={filteredGames} onSelect={handleSelectGame} featuredId={featuredGame?.id} />
        )}
      </div>
    </div>
  )
}
