import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import type { LiveGroup } from './liveUtils'
import { MatchCard } from '@/presentation/components/matches/MatchCard'
import { MatchCardSkeleton } from '@/presentation/components/ui/Skeleton'
import { CompetitionLogo } from '@/presentation/components/competition/CompetitionLogo'

interface LiveCenterGroupsProps {
  groups: LiveGroup[]
  loading: boolean
  onSelectGame: (game: Game) => void
  onShowUpcoming: () => void
}

/**
 * Vista En Vivo del centro (desktop): todos los vivos agrupados por liga.
 * Reemplaza los highlights curados mientras filter === 'live'.
 */
export const LiveCenterGroups = memo(function LiveCenterGroups({
  groups,
  loading,
  onSelectGame,
  onShowUpcoming,
}: LiveCenterGroupsProps) {
  const navigate = useNavigate()
  const total = groups.reduce((n, g) => n + g.games.length, 0)

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-muted font-body text-sm">Sin partidos en vivo ahora mismo</p>
        <button
          type="button"
          onClick={onShowUpcoming}
          className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible mt-2 rounded px-1 py-0.5 text-xs transition-colors"
        >
          Ver próximos partidos →
        </button>
      </div>
    )
  }

  return (
    <>
      {groups.map(({ competition: comp, games }) => (
        <section key={comp.id} aria-label={`En vivo · ${comp.shortName || comp.displayName}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(`/competicion/${comp.id}/standings`)}
              className="focus-visible group flex min-h-[44px] items-center gap-2 rounded-lg"
            >
              <CompetitionLogo id={comp.id} name={comp.shortName || comp.displayName} className="h-6 w-6 rounded" />
              <h2 className="font-display text-text-primary group-hover:text-accent-gold text-lg font-semibold transition-colors">
                {comp.shortName || comp.displayName}
              </h2>
              <span className="text-accent-live font-mono text-xs font-bold">
                ({games.length})
              </span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {games.map((g) => (
              <MatchCard key={g.id} game={g} onSelect={onSelectGame} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
})
