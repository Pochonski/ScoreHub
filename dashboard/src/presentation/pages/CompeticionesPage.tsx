import { useNavigate } from 'react-router-dom'
import { useCompetitions } from '@/presentation/hooks/useCompetitions'
import { HeroSkeleton } from '@/presentation/components/ui/Skeleton'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

export function CompeticionesPage() {
  const navigate = useNavigate()
  const { competitions, loading, error, refetch } = useCompetitions()

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
        <HeroSkeleton />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-elevated skeleton h-40 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-text-primary text-3xl font-bold tracking-wide sm:text-4xl">
          Competiciones
        </h1>
        <p className="font-body text-text-muted mt-2 text-sm">
          Selecciona una competición para ver tablas, estadísticas, historia y más.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {competitions.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate(`/competicion/${c.id}/standings`)}
            className="group bg-bg-card border-border-card hover:border-accent-gold/40 hover:bg-bg-elevated/50 focus-visible flex flex-col items-start gap-2 rounded-xl border p-6 text-left transition-all duration-200"
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className="flex-1">
                <h2 className="font-display text-text-primary group-hover:text-accent-gold text-lg font-bold tracking-wide transition-colors">
                  {c.displayName}
                </h2>
                <p className="font-body text-text-muted mt-1 text-xs">
                  {c.countryName || 'Internacional'}
                  {c.seasonLabel ? ` · ${c.seasonLabel}` : ''}
                </p>
              </div>
              {c.isFeatured && (
                <span className="bg-accent-gold/10 text-accent-gold font-body shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  Destacada
                </span>
              )}
            </div>

            <div className="font-body text-text-dim mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {c.hasGroups && <span>Grupos</span>}
              {c.hasBrackets && <span>Eliminatorias</span>}
              {c.hasHistory && <span>Historia</span>}
            </div>

            <div className="text-accent-gold/70 font-body mt-auto pt-3 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
              Ver competición →
            </div>
          </button>
        ))}
      </div>

      {competitions.length === 0 && (
        <div className="bg-bg-card border-border-card rounded-xl border p-8 text-center">
          <p className="text-text-muted font-body text-sm">
            No hay competiciones activas en este momento.
          </p>
        </div>
      )}
    </div>
  )
}
