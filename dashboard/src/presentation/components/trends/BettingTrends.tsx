import { useMemo, useState } from 'react'
import type { Trend } from '@/domain/entities/BettingTip'
import { BetTrendRow } from './BetTrendRow'
import { TrendDetailModal } from './TrendDetailModal'

interface BettingTrendsProps {
  trends: Trend[]
  /** Máximo de tendencias a mostrar. */
  limit?: number
}

/** Dedup por apuesta (betCTA/text), quedándose con el porcentaje más alto. */
function dedupe(trends: Trend[]): Trend[] {
  const best = new Map<string, Trend>()
  for (const t of trends) {
    const key = t.betCTA || t.text
    const cur = best.get(key)
    if (!cur || t.percentage > cur.percentage) best.set(key, t)
  }
  return Array.from(best.values()).sort((a, b) => b.percentage - a.percentage)
}

/**
 * BettingTrends — grilla premium de tendencias de la competición. Cada fila es
 * clickeable y abre el detalle con los partidos que la soportan. El encabezado
 * de sección lo pone el contenedor.
 */
export function BettingTrends({ trends, limit = 8 }: BettingTrendsProps) {
  const [selected, setSelected] = useState<Trend | null>(null)
  const rows = useMemo(() => dedupe(trends).slice(0, limit), [trends, limit])

  if (rows.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelected(t)}
            className="focus-visible hover:ring-border-card block rounded-xl text-left transition hover:ring-1"
            aria-label={`Ver detalle: ${t.betCTA || t.text}`}
          >
            <BetTrendRow trend={t} />
          </button>
        ))}
      </div>
      <p className="font-body text-text-dim mt-2 text-center text-[10px]">
        Toca una tendencia para ver los partidos que la soportan
      </p>
      <TrendDetailModal trend={selected} onClose={() => setSelected(null)} />
    </>
  )
}
