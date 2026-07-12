import { memo } from 'react'
import type { TournamentStatEntry } from '@/domain/entities/BettingTip'
import { useNavigate } from 'react-router-dom'

interface StatRowProps {
  entry: TournamentStatEntry
  maxValue: number
  position: number
}

export const StatRow = memo(function StatRow({ entry, maxValue, position }: StatRowProps) {
  const navigate = useNavigate()
  const percentage = maxValue > 0 ? (entry.value / maxValue) * 100 : 0

  return (
    <div
      className="group hover:bg-bg-elevated/50 -mx-2 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
      onClick={() => navigate(`/player/${entry.athleteId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/player/${entry.athleteId}`)
      }}
      tabIndex={0}
      role="button"
      aria-label={`${entry.name}, ${entry.value} ${entry.teamName || ''}`}
    >
      <span className="text-text-dim w-5 shrink-0 text-right font-mono text-xs">{position}</span>
      <div className="bg-bg-elevated h-7 w-7 shrink-0 overflow-hidden rounded-full">
        {entry.photoUrl ? (
          <img src={entry.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="font-display text-text-muted flex h-full w-full items-center justify-center text-xs">
            {entry.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="font-body text-text-primary block truncate text-sm leading-tight font-medium">
          {entry.name}
        </span>
        {entry.teamName && (
          <span className="font-body text-text-dim block truncate text-[11px]">{entry.teamName}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="bg-bg-elevated hidden h-1.5 w-16 overflow-hidden rounded-full sm:block">
          <div
            className="bg-accent-gold/60 h-full rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="font-display text-accent-gold w-6 text-right text-lg font-bold">{entry.value}</span>
      </div>
    </div>
  )
})
