import { memo } from 'react'
import type { Trend } from '@/domain/entities/BettingTip'

/**
 * Fallback de categoría por lineTypeId — para no depender de que el backend
 * envíe siempre `lineTypeLabel` (ej. el tipo 5 = resultado del primer tiempo).
 */
const LINE_TYPE_LABELS: Record<number, string> = {
  1: 'Ganador',
  3: 'Over/Under',
  5: '1er tiempo',
  7: 'Primer gol',
  12: 'Ambos marcan',
  14: 'Doble oportunidad',
}

function categoryLabel(trend: Trend): string | undefined {
  const fromId = LINE_TYPE_LABELS[trend.lineTypeId]
  if (fromId) return fromId
  // El backend a veces manda "Tipo N" como placeholder — evitarlo.
  if (trend.lineTypeLabel && !/^Tipo\s/i.test(trend.lineTypeLabel)) return trend.lineTypeLabel
  return undefined
}

/**
 * BetTrendRow — fila premium para una tendencia/tip de apuestas. Muestra la
 * categoría (lineTypeLabel), la apuesta sugerida (betCTA) como titular, la
 * evidencia (text) como subtítulo, y el porcentaje con una barra tonal.
 */
function tone(pct: number) {
  if (pct >= 75) return { bar: 'bg-accent-green', text: 'text-accent-green', chip: 'bg-accent-green/10 text-accent-green' }
  if (pct >= 60) return { bar: 'bg-accent-blue', text: 'text-accent-blue', chip: 'bg-accent-blue/10 text-accent-blue' }
  return { bar: 'bg-accent-gold', text: 'text-accent-gold', chip: 'bg-accent-gold/10 text-accent-gold' }
}

export const BetTrendRow = memo(function BetTrendRow({ trend }: { trend: Trend }) {
  const pct = Math.round((trend.percentage || 0) * 100)
  const t = tone(pct)
  const headline = trend.betCTA || trend.text
  const evidence = trend.betCTA ? trend.text : undefined
  const category = categoryLabel(trend)

  return (
    <div className="bg-bg-elevated/30 flex items-center gap-3 rounded-xl px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {category && (
            <span
              className={`font-body shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${t.chip}`}
            >
              {category}
            </span>
          )}
          <span className="font-body text-text-primary truncate text-[13px] font-semibold">
            {headline}
          </span>
        </div>
        {evidence && (
          <p className="font-body text-text-muted mt-0.5 truncate text-[11px]">{evidence}</p>
        )}
        <div className="bg-bg-elevated mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${t.bar} transition-all duration-500 ease-out`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      <div className={`font-display shrink-0 text-lg font-bold tabular-nums ${t.text}`}>{pct}%</div>
    </div>
  )
})
