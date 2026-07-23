import { useActiveCompetition } from '@/presentation/context/ActiveCompetitionContext'
import { useTournamentInfo } from '@/presentation/hooks/useTournamentInfo'
import { Link } from 'react-router-dom'
import { HeroSkeleton } from '@/presentation/components/ui/Skeleton'

interface Props {
  /** ID explícito. Si se omite, usa el active competition del context. */
  competitionId?: number | null
  /** Modo compacto: solo el nombre + link. */
  compact?: boolean
}

/**
 * CompetitionInfoCard — muestra información de la competición activa
 * (nombre oficial, país, temporada, formato) en la parte superior del dashboard.
 * Sirve como cabecera "tournament info" que antes mostraba la Mundial hardcoded.
 */
export function CompetitionInfoCard({ competitionId: propId, compact = false }: Props) {
  const { competitionId: ctxId } = useActiveCompetition()
  const id = propId ?? ctxId
  const { info, loading } = useTournamentInfo(id)

  if (!id) return null

  if (loading && !info) {
    return <HeroSkeleton />
  }
  if (!info) return null

  if (compact) {
    return (
      <Link
        to={`/competicion/${id}/standings`}
        className="group bg-bg-card border-border-card hover:border-accent-gold/30 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors"
        aria-label={`Ver información de ${info.name}`}
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-text-primary group-hover:text-accent-gold truncate text-base font-bold tracking-wide transition-colors">
            {info.name}
          </h2>
          <div className="text-text-muted font-body mt-0.5 flex items-center gap-2 text-[11px]">
            {info.seasonLabel && <span>{info.seasonLabel}</span>}
            {info.countryName && (
              <>
                <span className="text-text-dim">·</span>
                <span>{info.countryName}</span>
              </>
            )}
          </div>
        </div>
        <span className="text-accent-gold/60 group-hover:text-accent-gold shrink-0 text-xl transition-all group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    )
  }

  return (
    <section
      aria-label={`Información de ${info.name}`}
      className="bg-bg-card border-border-card relative overflow-hidden rounded-xl border"
    >
      {/* Banda superior con el color del equipo/competición */}
      {info.countryId && (
        <div
          className="h-2 w-full"
          style={{
            background: 'linear-gradient(90deg, var(--accent-gold) 0%, var(--accent-blue) 100%)',
          }}
        />
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-body text-text-dim mb-1 text-[10px] font-medium tracking-[0.2em] uppercase">
              Competición activa
            </p>
            <h1 className="font-display text-text-primary truncate text-2xl font-bold tracking-wide sm:text-3xl">
              {info.name}
            </h1>
            <div className="font-body text-text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {info.seasonLabel && (
                <span className="text-accent-gold font-mono">{info.seasonLabel}</span>
              )}
              {info.countryName && (
                <>
                  <span className="text-text-dim">·</span>
                  <span>{info.countryName}</span>
                </>
              )}
              {info.seasonNum && (
                <>
                  <span className="text-text-dim">·</span>
                  <span className="font-mono">Edición #{info.seasonNum}</span>
                </>
              )}
            </div>
          </div>

          <Link
            to={`/competicion/${id}/standings`}
            className="font-body text-accent-gold hover:text-accent-gold/80 focus-visible shrink-0 self-start rounded-lg px-4 py-2 text-sm font-medium underline-offset-4 transition-colors hover:underline sm:self-auto"
          >
            Ver tabla y estadísticas →
          </Link>
        </div>
      </div>
    </section>
  )
}
