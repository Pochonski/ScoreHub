import { memo } from 'react'
import type { BettingTip } from '@/domain/entities/BettingTip'
import { extractSampleSize } from '@/presentation/components/trends/bettingSignals'

interface MatchTipsProps {
  tips: BettingTip | null
}

export const MatchTips = memo(function MatchTips({ tips }: MatchTipsProps) {
  if (!tips?.topTrends?.length) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[11px] sm:text-[10px] tracking-wider uppercase">
          Tendencias del historial
        </h3>
        <p className="font-body text-text-dim mt-0.5 text-[11px]">
          Lo que pasó en partidos recientes, no una probabilidad futura
        </p>
      </div>
      <div className="space-y-3 p-5">
        {tips.topTrends.map((trend, i) => {
          const sample = extractSampleSize(trend.text)
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-body text-text-primary block truncate text-xs">{trend.text}</span>
                {sample && (
                  <span className="font-body text-text-dim mt-0.5 block text-[11px]">
                    Muestra: {sample} partidos
                  </span>
                )}
              </div>
              {/* percentage viene como fracción 0-1 del API: multiplicar ×100. */}
              <span className="text-accent-gold ml-2 shrink-0 font-mono text-xs">
                {((trend.percentage ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
