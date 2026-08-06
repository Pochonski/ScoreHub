import { useEffect, useRef, useState } from 'react'
import type { Game } from '@/domain/entities/Game'
import type { Competition } from '@/domain/entities/Competition'
import { CompactMatchRow } from './CompactMatchRow'
import { DatePickerCalendar } from './DatePickerCalendar'
import { CompetitionLogo } from '@/presentation/components/competition/CompetitionLogo'

type FilterValue = 'all' | 'live' | 'upcoming' | 'finished'
type CompetitionScope = { kind: 'all' } | { kind: 'one'; id: number }

interface LeaguesRailProps {
  competitions: Competition[]
  scope: CompetitionScope
  onScopeChange: (next: CompetitionScope) => void
  /** Partidos ya filtrados por fecha/estado, del scope activo. */
  games: Game[]
  liveCount: number
  onSelectGame: (game: Game) => void
  filter: FilterValue
  onFilterChange: (f: FilterValue) => void
  dateOffset: number | null
  onDateChange: (offset: number | null) => void
}

function dateLabel(offset: number | null): string {
  if (offset == null) return 'Todos los días'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  if (offset === 0) return 'Hoy'
  if (offset === 1) return 'Mañana'
  if (offset === -1) return 'Ayer'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function LeaguesRail({
  competitions,
  scope,
  onScopeChange,
  games,
  liveCount,
  onSelectGame,
  filter,
  onFilterChange,
  dateOffset,
  onDateChange,
}: LeaguesRailProps) {
  // El orden ya viene definido por el padre (featuredSorted, con el Mundial
  // al final por haber terminado). No re-ordenar aquí.
  const sorted = competitions

  const MATCH_LIMIT = 5
  const [expanded, setExpanded] = useState(false)
  // Colapsar los partidos de la liga activa sin cambiar de liga.
  const [activeCollapsed, setActiveCollapsed] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const activeId = scope.kind === 'one' ? scope.id : null
  // Al cambiar de liga activa (o de fecha/filtro que altera la lista), resetear.
  useEffect(() => {
    setExpanded(false)
    setActiveCollapsed(false)
  }, [activeId, dateOffset, filter])
  const shownGames = expanded ? games : games.slice(0, MATCH_LIMIT)

  // Cerrar el calendario al hacer click afuera.
  useEffect(() => {
    if (!calendarOpen) return
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [calendarOpen])

  // Conversión dateOffset (nº de días desde hoy) ↔ Date.
  const offsetToDate = (offset: number): Date => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset)
    return d
  }
  const dateToOffset = (date: Date): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
  }
  const selectedDate = dateOffset == null ? null : offsetToDate(dateOffset)

  // Flechas: mueven un día (sin límite). Base "hoy" cuando es "Todos los días".
  const stepDate = (dir: -1 | 1) => {
    onDateChange((dateOffset ?? 0) + dir)
  }

  return (
    <div className="space-y-4">
      {/* Navegador de fecha (con calendario) */}
      <div className="relative" ref={calendarRef}>
      <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={() => stepDate(-1)}
            className="hover:bg-bg-elevated focus-visible text-text-muted hover:text-text-primary rounded-lg p-1.5 transition-colors"
            aria-label="Día anterior"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 3l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCalendarOpen((o) => !o)}
            className="font-body text-text-primary hover:bg-bg-elevated focus-visible flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-semibold transition-colors"
            aria-haspopup="dialog"
            aria-expanded={calendarOpen}
            title="Elegir día"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
              <path d="M4.5 1v3M9.5 1v3M1.5 5.5h11" strokeLinecap="round" />
            </svg>
            {dateLabel(dateOffset)}
          </button>
          <button
            type="button"
            onClick={() => stepDate(1)}
            className="hover:bg-bg-elevated focus-visible text-text-muted hover:text-text-primary rounded-lg p-1.5 transition-colors"
            aria-label="Día siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {/* Toggle Vivo / Todos */}
        <div className="border-border-card grid grid-cols-2 border-t">
          <button
            type="button"
            onClick={() => onFilterChange('live')}
            className={`font-body flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
              filter === 'live' ? 'text-accent-live' : 'text-text-muted hover:text-text-primary'
            }`}
            aria-pressed={filter === 'live'}
          >
            {filter === 'live' && <span className="bg-accent-live live-pulse h-1.5 w-1.5 rounded-full" />}
            Vivo
            {liveCount > 0 && <span className="text-text-dim">({liveCount})</span>}
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`font-body border-border-card border-l py-2 text-xs font-semibold transition-colors ${
              filter === 'all' ? 'text-accent-gold' : 'text-text-muted hover:text-text-primary'
            }`}
            aria-pressed={filter === 'all'}
          >
            Por hora
          </button>
        </div>
      </div>

      {calendarOpen && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 flex justify-center">
          <DatePickerCalendar
            selected={selectedDate}
            onSelect={(date) => {
              onDateChange(date == null ? null : dateToOffset(date))
              setCalendarOpen(false)
            }}
          />
        </div>
      )}
      </div>

      {/* Ligas populares */}
      <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
        <h2 className="font-body text-text-muted border-border-card border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wider">
          Ligas populares
        </h2>
        <div className="divide-border-card/60 divide-y">
          {sorted.map((comp) => {
            const active = scope.kind === 'one' && scope.id === comp.id
            const open = active && !activeCollapsed
            return (
              <div key={comp.id}>
                <button
                  type="button"
                  onClick={() =>
                    active
                      ? setActiveCollapsed((v) => !v)
                      : onScopeChange({ kind: 'one', id: comp.id })
                  }
                  className={`font-body focus-visible flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                    active ? 'bg-accent-gold/5' : 'hover:bg-bg-elevated'
                  }`}
                  aria-expanded={open}
                >
                  <CompetitionLogo
                    id={comp.id}
                    name={comp.shortName || comp.displayName}
                    className="h-6 w-6 rounded"
                  />
                  <span
                    className={`min-w-0 flex-1 truncate font-medium ${
                      active ? 'text-accent-gold' : 'text-text-primary'
                    }`}
                  >
                    {comp.shortName || comp.displayName}
                  </span>
                  {comp.countryName && (
                    <span className="text-text-dim shrink-0 font-mono text-[10px] uppercase">
                      {comp.countryName}
                    </span>
                  )}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-text-dim shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
                    aria-hidden="true"
                  >
                    <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Partidos de la liga activa (expandible/colapsable) */}
                {open && (
                  <div className="px-1.5 pb-2">
                    {games.length === 0 ? (
                      <p className="text-text-dim font-body px-2 py-3 text-center text-xs">
                        Sin partidos para esta fecha
                      </p>
                    ) : (
                      <>
                        {shownGames.map((game) => (
                          <CompactMatchRow key={game.id} game={game} onSelect={onSelectGame} />
                        ))}
                        {games.length > MATCH_LIMIT && (
                          <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="font-body text-accent-blue hover:bg-bg-elevated focus-visible mt-1 w-full rounded-lg py-1.5 text-center text-xs font-medium transition-colors"
                          >
                            {expanded ? 'Ver menos' : `Ver ${games.length - MATCH_LIMIT} partidos más`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
