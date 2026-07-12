import type { Trend } from '@/domain/entities/BettingTip'
import { ConfidenceBar } from '@/presentation/components/ui/ConfidenceBar'

interface BettingTrendsProps {
  trends: Trend[]
}

export function BettingTrends({ trends }: BettingTrendsProps) {
  if (trends.length === 0) return null

  return (
    <div>
      <h2 className="font-display text-text-primary mb-3 text-xl font-semibold">Tendencias</h2>
      <div className="bg-bg-card border-border-card space-y-4 rounded-xl border p-4">
        {trends.slice(0, 8).map((t, i) => (
          <ConfidenceBar
            key={i}
            percentage={t.percentage * 100}
            label={t.text || t.betCTA}
            value={`${(t.percentage * 100).toFixed(0)}%`}
          />
        ))}
        <p className="font-body text-text-dim border-border-card border-t pt-1 text-center text-[10px]">
          Las tendencias se actualizan cada 30 minutos
        </p>
      </div>
    </div>
  )
}
