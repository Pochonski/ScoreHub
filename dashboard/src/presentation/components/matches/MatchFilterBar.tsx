import { memo } from 'react'

type FilterValue = 'all' | 'live' | 'upcoming' | 'finished'

interface MatchFilterBarProps {
  active: FilterValue
  counts: Record<FilterValue, number>
  onChange: (filter: FilterValue) => void
  dateOffset?: number | null
  onDateChange?: (offset: number | null) => void
}

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'live', label: 'En Vivo' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'finished', label: 'Finalizados' },
]

const DATE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Todo' },
  { value: -1, label: 'Ayer' },
  { value: 0, label: 'Hoy' },
  { value: 1, label: 'Mañana' },
]

export const MatchFilterBar = memo(function MatchFilterBar({
  active,
  counts,
  onChange,
  dateOffset = null,
  onDateChange,
}: MatchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar partidos">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={`font-body focus-visible rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            active === filter.value
              ? 'bg-accent-blue/15 text-accent-blue'
              : 'bg-bg-card text-text-muted hover:text-text-primary hover:bg-bg-elevated'
          }`}
          aria-pressed={active === filter.value}
        >
          {filter.label}
          {counts[filter.value] > 0 && (
            <span
              className={`ml-1.5 text-xs ${
                active === filter.value ? 'text-accent-blue/70' : 'text-text-dim'
              }`}
            >
              {counts[filter.value]}
            </span>
          )}
        </button>
      ))}
      {onDateChange && <span className="bg-border-card mx-1 h-5 w-px" />}
      {onDateChange &&
        DATE_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onDateChange(opt.value)}
            className={`font-body focus-visible rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              dateOffset === opt.value
                ? 'bg-accent-gold/15 text-accent-gold'
                : 'bg-bg-card text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
            aria-pressed={dateOffset === opt.value}
          >
            {opt.label}
          </button>
        ))}
    </div>
  )
})
