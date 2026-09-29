import { memo } from 'react'
import type { Prediction } from '@/domain/entities/Prediction'
import { sampleLevel, formatVotes } from '@/presentation/components/trends/bettingSignals'

interface MatchPredictionsProps {
  predictions: Prediction[]
}

export const MatchPredictions = memo(function MatchPredictions({ predictions }: MatchPredictionsProps) {
  if (!predictions || predictions.length === 0) return null
  // Encuestas con muestra ínfima se descartan (ruido); el resto se ordena
  // por votos para jerarquizar por calidad de muestra.
  const visible = predictions
    .filter((p) => (p.options || []).some((o) => o && o.text))
    .filter((p) => sampleLevel(p.totalVotes) !== 'hide')
    .sort((a, b) => (b.totalVotes ?? 0) - (a.totalVotes ?? 0))
  if (visible.length === 0) return null

  const renderOptions = (p: Prediction) => {
    const opts = (p.options || []).filter((o) => o && o.text)
    return (
      <div className="space-y-2">
        {opts.map((o, j) => {
          const pct = typeof o.percentage === 'number' ? o.percentage : 0
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
    )
  }

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[11px] sm:text-[10px] tracking-wider uppercase">
          Pronóstico de la comunidad
        </h3>
        <p className="font-body text-text-dim mt-0.5 text-[11px]">
          Votación de hinchas, no probabilidad
        </p>
      </div>
      <div className="space-y-4 p-5">
        {visible.map((p, i) => {
          const votes = p.totalVotes ?? 0
          const header = (
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="font-body text-text-primary text-xs font-semibold">{p.title}</h4>
              <span className="font-body text-text-dim shrink-0 text-[11px]">{formatVotes(votes)}</span>
            </div>
          )
          if (sampleLevel(votes) === 'small') {
            return (
              <details key={i} className="bg-bg-elevated/30 rounded-lg px-3 py-2">
                <summary className="font-body text-text-muted cursor-pointer text-xs select-none">
                  {p.title} · <span className="text-accent-gold">muestra pequeña ({formatVotes(votes)})</span>
                </summary>
                <div className="mt-2">{renderOptions(p)}</div>
              </details>
            )
          }
          return (
            <div key={i}>
              {header}
              {renderOptions(p)}
            </div>
          )
        })}
      </div>
    </div>
  )
})
