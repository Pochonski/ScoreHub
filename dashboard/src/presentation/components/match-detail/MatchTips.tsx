import { memo } from 'react'
import type { BettingTip } from '@/domain/entities/BettingTip'

interface MatchTipsProps {
  tips: BettingTip | null
}

export const MatchTips = memo(function MatchTips({ tips }: MatchTipsProps) {
  if (!tips?.topTrends?.length) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">Tendencias</h3>
      </div>
      <div className="space-y-3 p-5">
        {tips.topTrends.map((trend, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="font-body text-text-primary text-xs">{trend.text}</span>
            <span className="text-accent-gold ml-2 font-mono text-xs">
              {(trend.percentage ?? 0).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
