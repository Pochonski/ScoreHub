import { useState, useMemo } from 'react'
import type { BettingTip, Trend } from '@/domain/entities/BettingTip'
import { ConfidenceBar } from '@/presentation/components/ui/ConfidenceBar'

interface MatchTipsProps {
  tips: BettingTip | null
}

function deduplicateTrends(trends: Trend[]): Trend[] {
  const seenBetCTA = new Map<string, Trend>()
  const bestPerLineType = new Map<number, Trend>()

  for (const trend of trends) {
    const key = trend.betCTA || trend.text
    const existing = seenBetCTA.get(key)
    if (!existing || trend.percentage > existing.percentage) {
      seenBetCTA.set(key, trend)
    }

    const best = bestPerLineType.get(trend.lineTypeId)
    if (!best || trend.percentage > best.percentage) {
      bestPerLineType.set(trend.lineTypeId, trend)
    }
  }

  return Array.from(seenBetCTA.values()).filter((trend) => bestPerLineType.get(trend.lineTypeId) === trend)
}

export function MatchTips({ tips }: MatchTipsProps) {
  const [showAll, setShowAll] = useState(false)

  const dedupedTop = useMemo(() => (tips ? deduplicateTrends(tips.topTrends) : []), [tips])
  const dedupedAll = useMemo(() => (tips ? deduplicateTrends(tips.allTrends) : []), [tips])

  if (!tips || dedupedTop.length === 0) return null

  const displayTrends = showAll ? dedupedAll : dedupedTop.slice(0, 5)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-body text-text-primary text-xs font-semibold">Tips del partido</h4>
        <span className="text-accent-gold font-mono text-xs">
          {(tips.confidenceScore * 100).toFixed(0)}% confianza
        </span>
      </div>
      <div className="space-y-2">
        {displayTrends.map((trend, i) => (
          <ConfidenceBar
            key={i}
            percentage={trend.percentage * 100}
            label={trend.text || trend.betCTA}
            value={`${(trend.percentage * 100).toFixed(0)}%`}
            size="sm"
          />
        ))}
      </div>
      {dedupedAll.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible text-xs transition-colors"
        >
          {showAll ? 'Mostrar menos' : `Ver todas las tendencias (${dedupedAll.length})`}
        </button>
      )}
    </div>
  )
}
