import type { TournamentStatEntry } from '@/domain/entities/BettingTip'
import { StatRow } from './StatRow'

interface AssistsProps {
  assists: TournamentStatEntry[]
  hideTitle?: boolean
}

export function Assists({ assists, hideTitle }: AssistsProps) {
  if (assists.length === 0) return null

  const maxValue = assists[0]?.value || 1

  return (
    <div>
      {!hideTitle && (
        <h3 className="font-body text-text-muted mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <span>🅰️</span> Asistencias
        </h3>
      )}
      <div className="space-y-0.5">
        {assists.slice(0, 10).map((a, i) => (
          <StatRow key={a.athleteId} entry={a} maxValue={maxValue} position={i + 1} />
        ))}
      </div>
    </div>
  )
}
