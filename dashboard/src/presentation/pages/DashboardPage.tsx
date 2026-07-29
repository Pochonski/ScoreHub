import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import { HeroMatch } from '@/presentation/components/hero/HeroMatch'
import { FeaturedHero } from '@/presentation/components/hero/FeaturedHero'
import { MatchTicker } from '@/presentation/components/matches/MatchTicker'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { MatchCard } from '@/presentation/components/matches/MatchCard'
import { CompetitionInfoCard } from '@/presentation/components/competition/CompetitionInfoCard'
import { MatchFilterBar } from '@/presentation/components/matches/MatchFilterBar'
import { LeaguesRail } from '@/presentation/components/dashboard/LeaguesRail'
import { StatsRail } from '@/presentation/components/dashboard/StatsRail'
import { StandingsRail } from '@/presentation/components/dashboard/StandingsRail'
import { NewsRail } from '@/presentation/components/dashboard/NewsRail'
import {
  useFeaturedGame,
  useLiveGames,
  useGames,
  useFeaturedGamesByComp,
} from '@/presentation/hooks/useGames'
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
  const featuredIds = useMemo(() => featured.map((c) => c.id), [featured])
  // Partido destacado de cada competición → para ordenar por "partido más
  // próximo" y elegir el default.
  const featuredGamesByComp = useFeaturedGamesByComp(featuredIds)

  // Orden de las competiciones según su partido destacado:
  //  - en vivo / próximo → primero (el más próximo antes)
  //  - terminado / sin dato → después, por displayOrder
  //  - el Mundial ya terminado (flagship sin próximos) → siempre al final
  const featuredSorted = useMemo(() => {
    const now = Date.now()
    const rank = (c: (typeof featured)[number]): [number, number] => {
      const g = featuredGamesByComp.get(c.id)
      if (g && g.status === 'live') return [0, now]
      if (g && g.status === 'upcoming') {
        const t = new Date(g.startTime).getTime()
        return [0, Number.isNaN(t) ? now : t]
      }
      if (c.id === PRIMARY_COMPETITION_ID) return [2, c.displayOrder]
      return [1, c.displayOrder]
    }
    return [...featured].sort((a, b) => {
      const [ga, ka] = rank(a)
      const [gb, kb] = rank(b)
      return ga !== gb ? ga - gb : ka - kb
    })
  }, [featured, featuredGamesByComp])

  // Default: seleccionar la competición con el partido más próximo — solo si el
  // usuario no eligió una explícitamente (URL / localStorage / click).
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (autoSelectedRef.current) return
    if (activeCompIdFromCtx != null) {
      autoSelectedRef.current = true
      return
    }
    if (featuredSorted.length === 0) return
    autoSelectedRef.current = true
    const first = featuredSorted[0]
    if (first && !(scope.kind === 'one' && scope.id === first.id)) {
      setScope({ kind: 'one', id: first.id })
    }
    // setScope y scope quedan fuera de deps a propósito: el ref evita re-ejecución.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompIdFromCtx, featuredSorted])

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

  const activeCompId = scope.kind === 'one' ? scope.id : undefined
  const activeComp =
    activeCompId != null ? featuredSorted.find((c) => c.id === activeCompId) : undefined

  // Highlights del centro (desktop): próximos partidos, o resultados recientes
  // si ya no quedan próximos. Es una selección curada, no el listado completo
  // (ese vive en el rail izquierdo).
  const highlightGames = useMemo(() => {
    const upcoming = allGames
      .filter((g) => g.status === 'upcoming')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    if (upcoming.length > 0) return { title: 'Próximos partidos', games: upcoming.slice(0, 6) }
    const finished = allGames
      .filter((g) => g.status === 'finished')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    return { title: 'Resultados recientes', games: finished.slice(0, 6) }
  }, [allGames])

  if (gamesError && allGames.length === 0 && liveGames.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <ErrorState message={gamesError} onRetry={refetchGames} fullPage />
      </div>
    )
  }

  // ----- Bloque central: hero + grid (compartido entre mobile y desktop) -----
  const centerColumn = (
    <div>
      {/* Hero destacado: desktop = FeaturedHero (365scores), mobile = HeroMatch. */}
      <section aria-label="Partido destacado" className="hidden px-4 pt-1 lg:block lg:px-0 lg:pt-0">
        {featuredLoading ? <HeroSkeleton /> : featuredGame ? <FeaturedHero game={featuredGame} /> : null}
      </section>
      <section aria-label="Partido destacado" ref={heroRef} className="lg:hidden">
        {featuredLoading ? <HeroSkeleton /> : featuredGame ? <HeroMatch game={featuredGame} /> : null}
      </section>

      {liveGames.length > 0 && (
        <div className="mt-1 flex justify-end px-4 lg:px-0" aria-live="polite" aria-atomic="true" role="status">
          <span className="text-text-dim flex items-center gap-1.5 font-mono text-[10px]">
            <span className="bg-accent-live/60 h-1.5 w-1.5 animate-pulse rounded-full" />
            Actualizando cada 30s
          </span>
        </div>
      )}

      {/* Live ticker */}
      {liveGames.length > 0 && (
        <div className="mt-4 px-4 lg:px-0">
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
        <div className="mt-4 px-4 lg:px-0">
          <CompetitionInfoCard competitionId={scope.id} />
        </div>
      )}

      {liveError && (
        <div className="mt-2 px-4 lg:px-0">
          <p className="text-accent-red font-mono text-[10px]">{liveError}</p>
        </div>
      )}

      {/* Match Grid — solo mobile/tablet. En desktop la lista vive en el rail izquierdo. */}
      <div className="mt-6 px-4 lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-text-primary text-lg font-semibold">Partidos</h2>
          <button
            onClick={() => navigate('/analisis')}
            className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded px-1 py-0.5 text-xs transition-colors"
          >
            Análisis →
          </button>
        </div>

        {/* Competition tabs + filtros: solo mobile/tablet. En desktop van al rail izquierdo. */}
        <div>
          {featuredSorted.length > 0 && (
            <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto">
              {featuredSorted.map(c => (
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
        </div>

        {gamesLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      {/* Highlights desktop: selección curada (próximos o resultados recientes). */}
      <div className="mt-6 hidden lg:block">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-text-primary text-lg font-semibold">{highlightGames.title}</h2>
          <button
            onClick={() => navigate('/analisis')}
            className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded px-1 py-0.5 text-xs transition-colors"
          >
            Análisis →
          </button>
        </div>
        {gamesLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : highlightGames.games.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {highlightGames.games.map((g) => (
              <MatchCard key={g.id} game={g} onSelect={handleSelectGame} />
            ))}
          </div>
        ) : (
          <p className="text-text-muted font-body py-8 text-center text-sm">
            No hay partidos para mostrar
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1400px]">
      {heroCompact && featuredGame && (
        <div className="fixed top-14 right-0 left-0 z-40 lg:hidden">
          <HeroMatch game={featuredGame} compact />
        </div>
      )}

      {/* Desktop: 3 columnas (rail izq · centro · rail der). Mobile: solo centro. */}
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:gap-5 lg:px-4 lg:pt-4">
        {/* Rail izquierdo — ligas + partidos compactos */}
        <aside className="hidden lg:block" aria-label="Ligas y partidos">
          <div className="sticky top-[72px] pb-4">
            <LeaguesRail
              competitions={featuredSorted}
              scope={scope}
              onScopeChange={handleScopeChange}
              games={filteredGames}
              liveCount={liveGames.length}
              onSelectGame={handleSelectGame}
              filter={filter}
              onFilterChange={setFilter}
              dateOffset={dateOffset}
              onDateChange={setDateOffset}
            />
          </div>
        </aside>

        {/* Centro */}
        {centerColumn}

        {/* Rail derecho — goleadores · tabla · noticias */}
        <aside className="hidden lg:block" aria-label="Estadísticas">
          <div className="sticky top-[72px] space-y-4 pb-4">
            <StatsRail competitionId={activeCompId} seasonNum={activeComp?.seasonNum} />
            <StandingsRail competitionId={activeCompId} seasonNum={activeComp?.seasonNum} />
            <NewsRail competitionId={activeCompId} />
          </div>
        </aside>
      </div>
    </div>
  )
}
