import { useNavigate } from 'react-router-dom'
import { TopScorers } from '@/presentation/components/stats/TopScorers'
import { Assists } from '@/presentation/components/stats/Assists'
import { Ratings } from '@/presentation/components/stats/Ratings'
import { useTournamentStats } from '@/presentation/hooks/useTournamentStats'
import { CollapsibleSection } from './CollapsibleSection'

interface StatsRailProps {
  competitionId?: number
  seasonNum?: number
}

function RowsSkeleton({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton h-8 rounded-lg" />
      ))}
    </div>
  )
}

export function StatsRail({ competitionId, seasonNum }: StatsRailProps) {
  const navigate = useNavigate()
  const { scorers, assists, ratings, loading } = useTournamentStats(
    competitionId ?? null,
    seasonNum ?? null
  )

  const moreLink = (
    <button
      type="button"
      onClick={() => navigate('/analisis')}
      className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded text-[11px] transition-colors"
    >
      Ver más →
    </button>
  )

  return (
    <>
      <CollapsibleSection icon="⚽" title="Goleadores" storageKey="rail:scorers" action={moreLink}>
        <div className="px-2 py-2">
          {loading ? (
            <RowsSkeleton n={6} />
          ) : scorers.length > 0 ? (
            <TopScorers scorers={scorers} hideTitle />
          ) : (
            <p className="text-text-dim font-body px-2 py-6 text-center text-xs">
              Sin datos de goleadores
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Asistencias y Valoraciones: solo si la competición tiene esos datos
          (muchas ligas —ej. Promerica— no los publican en la fuente). */}
      {assists.length > 0 && (
        <CollapsibleSection
          icon="🅰️"
          title="Asistencias"
          storageKey="rail:assists"
          defaultOpen={false}
          action={moreLink}
        >
          <div className="px-2 py-2">
            <Assists assists={assists} hideTitle />
          </div>
        </CollapsibleSection>
      )}

      {ratings.length > 0 && (
        <CollapsibleSection
          icon="⭐"
          title="Valoraciones"
          storageKey="rail:ratings"
          defaultOpen={false}
          action={moreLink}
        >
          <div className="px-2 py-2">
            <Ratings ratings={ratings} hideTitle />
          </div>
        </CollapsibleSection>
      )}
    </>
  )
}
