import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StandingGroup } from '@/domain/entities/Standing'
import { GroupStandings } from '@/presentation/components/standings/GroupStandings'

interface MatchGroupTableProps {
  group: StandingGroup
  competitionId?: number | null
  homeTeamId: number
  awayTeamId: number
}

/**
 * Mini-tabla del grupo compartido por los dos equipos, con sus filas
 * resaltadas y acceso a la tabla completa.
 */
export const MatchGroupTable = memo(function MatchGroupTable({
  group,
  competitionId,
  homeTeamId,
  awayTeamId,
}: MatchGroupTableProps) {
  const navigate = useNavigate()
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-body text-text-dim text-[11px] tracking-wider uppercase">
          {group.displayName || group.name}
        </p>
        {competitionId != null && (
          <button
            type="button"
            onClick={() => navigate(`/competicion/${competitionId}/standings`)}
            className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded px-1 py-0.5 text-[11px] transition-colors"
          >
            Ver tabla →
          </button>
        )}
      </div>
      <GroupStandings groups={[group]} hideHeader highlightIds={[homeTeamId, awayTeamId]} />
    </div>
  )
})
