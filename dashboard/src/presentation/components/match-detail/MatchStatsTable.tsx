import { memo } from 'react'
import type { GameStat } from '@/domain/entities/Game'

interface MatchStatsTableProps {
  stats: GameStat[]
}

export const MatchStatsTable = memo(function MatchStatsTable({ stats }: MatchStatsTableProps) {
  if (stats.length === 0) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">
          Estadísticas del Partido
        </h3>
      </div>
      <div className="p-5">
        <div className="border-border-card overflow-hidden rounded-lg border">
          <div className="bg-border-card font-body grid grid-cols-3 gap-px text-xs">
            {stats.map((stat, i) => (
              <div key={i} className={`contents ${i % 2 === 0 ? 'bg-bg-elevated/20' : 'bg-bg-card'}`}>
                <div className="text-text-muted px-3 py-2 text-right">{stat.homeValue}</div>
                <div className="text-text-dim px-3 py-2 text-center font-medium">{stat.label}</div>
                <div className="text-text-muted px-3 py-2">{stat.awayValue}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
