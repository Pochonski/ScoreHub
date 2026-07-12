import type { TournamentStatEntry } from '@/domain/entities/BettingTip'
import { StatRow } from './StatRow'

interface TopScorersProps {
  scorers: TournamentStatEntry[]
  hideTitle?: boolean
}

export function TopScorers({ scorers, hideTitle }: TopScorersProps) {
  if (scorers.length === 0) return null

  const maxValue = scorers[0]?.value || 1

  return (
    <div>
      {!hideTitle && (
        <h3 className="font-body text-text-muted mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <span>⚽</span> Goleadores
        </h3>
      )}
      <div className="space-y-0.5">
        {scorers.slice(0, 10).map((s, i) => (
          <StatRow key={s.athleteId} entry={s} maxValue={maxValue} position={i + 1} />
        ))}
      </div>
    </div>
  )
}
