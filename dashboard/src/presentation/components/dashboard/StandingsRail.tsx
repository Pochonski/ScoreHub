import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStandings } from '@/presentation/hooks/useStandings'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { CollapsibleSection } from './CollapsibleSection'

interface StandingsRailProps {
  competitionId?: number
  seasonNum?: number
}

export function StandingsRail({ competitionId, seasonNum }: StandingsRailProps) {
  const { groups, loading } = useStandings(competitionId ?? null, { seasonNum: seasonNum ?? undefined })

  // Grupo a mostrar: el de la etapa actual, o el primero disponible.
  const group = useMemo(() => {
    if (groups.length === 0) return null
    return groups.find((g) => g.isCurrentStage) ?? groups[0]
  }, [groups])

  if (!competitionId) return null
  if (!loading && !group) return null

  const rows = group?.rows.slice(0, 6) ?? []

  return (
    <CollapsibleSection
      icon="🏆"
      storageKey="rail:standings"
      title={
        <>
          Tabla
          {group?.displayName && <span className="text-text-dim"> · {group.displayName}</span>}
        </>
      }
      action={
        <Link
          to={`/competicion/${competitionId}/standings`}
          className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded text-[11px] transition-colors"
        >
          Ver completa →
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-6 rounded" />
          ))}
        </div>
      ) : (
        <div className="px-1 py-1.5">
          {/* Encabezado de columnas */}
          <div className="text-text-dim font-mono grid grid-cols-[1.25rem_1fr_1.5rem_1.75rem] items-center gap-2 px-2 py-1 text-[10px] uppercase">
            <span className="text-center">#</span>
            <span>Equipo</span>
            <span className="text-center">PJ</span>
            <span className="text-center">Pts</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.team.id}
              className="hover:bg-bg-elevated grid grid-cols-[1.25rem_1fr_1.5rem_1.75rem] items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
            >
              <span className="text-text-muted text-center font-mono text-xs">{r.position}</span>
              <div className="flex min-w-0 items-center gap-2">
                <TeamBadge src={r.team.badgeUrl} name={r.team.name} size="xs" />
                <span className="font-body text-text-primary truncate text-[13px]">{r.team.name}</span>
              </div>
              <span className="text-text-muted text-center font-mono text-xs">{r.played}</span>
              <span className="font-display text-text-primary text-center text-sm font-bold">{r.points}</span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
