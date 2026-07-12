import { memo } from 'react'
import type { Prediction } from '@/domain/entities/Prediction'

interface MatchPredictionsProps {
  predictions: Prediction[]
}

export const MatchPredictions = memo(function MatchPredictions({ predictions }: MatchPredictionsProps) {
  if (predictions.length === 0) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">Predicciones</h3>
      </div>
      <div className="space-y-4 p-5">
        {predictions.map((p, i) => (
          <div key={i}>
            <h4 className="font-body text-text-primary mb-2 text-xs font-semibold">{p.title}</h4>
            <div className="space-y-2">
              {p.options.map((o, j) => {
                const pct = o.percentage ?? 0
                return (
                  <div key={j} className="flex items-center gap-3">
                    <div className="bg-bg-elevated relative h-6 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-accent-blue/30 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="font-body text-text-primary absolute inset-0 flex items-center px-2 text-[11px]">
                        {o.text}
                      </span>
                    </div>
                    <span className="text-text-muted w-10 text-right font-mono text-xs">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
