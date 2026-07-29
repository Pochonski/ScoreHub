import { useState } from 'react'

interface DatePickerCalendarProps {
  /** Día seleccionado, o null si es "Todos los días". */
  selected: Date | null
  /** Devuelve el día elegido, o null para "Todos los días". */
  onSelect: (date: Date | null) => void
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function DatePickerCalendar({ selected, onSelect }: DatePickerCalendarProps) {
  const today = startOfDay(new Date())
  const [view, setView] = useState(() => {
    const base = selected ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const year = view.getFullYear()
  const month = view.getMonth()
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const shiftMonth = (dir: -1 | 1) => setView(new Date(year, month + dir, 1))

  return (
    <div className="bg-bg-card border-border-card w-[16.5rem] rounded-xl border p-3 shadow-xl">
      {/* Cabecera: mes/año + navegación */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="hover:bg-bg-elevated focus-visible text-text-muted hover:text-text-primary rounded-lg p-1.5 transition-colors"
          aria-label="Mes anterior"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 3l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="font-body text-text-primary text-sm font-semibold">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="hover:bg-bg-elevated focus-visible text-text-muted hover:text-text-primary rounded-lg p-1.5 transition-colors"
          aria-label="Mes siguiente"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Días de la semana */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-text-dim text-center font-mono text-[10px] uppercase">
            {w}
          </span>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date, i) => {
          if (!date) return <span key={i} />
          const isToday = sameDay(date, today)
          const isSelected = sameDay(date, selected)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(date)}
              className={`focus-visible font-body flex h-8 items-center justify-center rounded-lg text-xs transition-colors ${
                isSelected
                  ? 'bg-accent-gold text-bg-base font-bold'
                  : isToday
                    ? 'text-accent-blue hover:bg-bg-elevated font-semibold'
                    : 'text-text-primary hover:bg-bg-elevated'
              }`}
              aria-label={date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              aria-current={isToday ? 'date' : undefined}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      {/* Acciones */}
      <div className="border-border-card mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="font-body text-text-muted hover:text-text-primary focus-visible rounded-lg px-2 py-1 text-xs font-medium transition-colors"
        >
          Todos los días
        </button>
        <button
          type="button"
          onClick={() => onSelect(today)}
          className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
        >
          Hoy
        </button>
      </div>
    </div>
  )
}
