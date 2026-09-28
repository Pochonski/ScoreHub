import { memo, useState, useRef, useEffect } from 'react'
import { DatePickerCalendar } from '@/presentation/components/dashboard/DatePickerCalendar'
import { useFocusTrap } from '@/presentation/hooks/useFocusTrap'

type FilterValue = 'all' | 'live' | 'upcoming' | 'finished'

function offsetToDate(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}
function dateToOffset(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(date)
  t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - today.getTime()) / 86400000)
}
function offsetLabel(offset: number | null): string {
  if (offset == null) return 'Fecha'
  if (offset === 0) return 'Hoy'
  if (offset === 1) return 'Mañana'
  if (offset === -1) return 'Ayer'
  return offsetToDate(offset).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

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
  const [dateOpen, setDateOpen] = useState(false)
  const hasDates = Boolean(onDateChange)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, dateOpen)

  useEffect(() => {
    if (!dateOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDateOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [dateOpen])

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
      {/* Status filters: scroll horizontal en mobile, inline en desktop. */}
      <div
        className="no-scrollbar flex gap-2 overflow-x-auto md:flex-wrap"
        role="group"
        aria-label="Filtrar partidos por estado"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => onChange(filter.value)}
            className={`font-body focus-visible min-h-[44px] shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
              active === filter.value
                ? 'bg-accent-blue/15 text-accent-blue'
                : 'bg-bg-card text-text-muted hover:bg-bg-elevated hover:text-text-primary'
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
      </div>

      {/* Date filters: en desktop visibles inline; en mobile tras botón "Fecha". */}
      {hasDates && (
        <>
          {/* Desktop */}
          <div className="hidden items-center gap-2 md:flex">
            <span className="bg-border-card mx-1 h-5 w-px" aria-hidden="true" />
            {DATE_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => onDateChange?.(opt.value)}
                className={`font-body focus-visible min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  dateOffset === opt.value
                    ? 'bg-accent-gold/15 text-accent-gold'
                    : 'bg-bg-card text-text-muted hover:bg-bg-elevated hover:text-text-primary'
                }`}
                aria-pressed={dateOffset === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Mobile: botón que abre el calendario en un modal centrado. */}
          <div className="md:hidden">
            <button
              onClick={() => setDateOpen(true)}
              className={`font-body focus-visible flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                dateOffset !== null
                  ? 'bg-accent-gold/15 text-accent-gold'
                  : 'bg-bg-card text-text-muted hover:bg-bg-elevated hover:text-text-primary'
              }`}
              aria-haspopup="dialog"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
                <path d="M4.5 1v3M9.5 1v3M1.5 5.5h11" strokeLinecap="round" />
              </svg>
              {offsetLabel(dateOffset)}
            </button>
            {dateOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                onClick={() => setDateOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-label="Elegir día"
              >
                <div
                  ref={dialogRef}
                  onClick={(e) => e.stopPropagation()}
                  className="relative max-h-[85dvh] overflow-y-auto"
                >
                  <button
                    type="button"
                    onClick={() => setDateOpen(false)}
                    className="bg-bg-card text-text-muted hover:text-text-primary focus-visible absolute top-2 right-2 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors"
                    aria-label="Cerrar calendario"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
                    </svg>
                  </button>
                  <DatePickerCalendar
                    selected={dateOffset == null ? null : offsetToDate(dateOffset)}
                    onSelect={(date) => {
                      onDateChange?.(date == null ? null : dateToOffset(date))
                      setDateOpen(false)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
})
