import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Athlete } from '@/domain/entities/Athlete'
import type { Team } from '@/domain/entities/Team'
import type { Competition } from '@/domain/entities/Competition'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { useFocusTrap } from '@/presentation/hooks/useFocusTrap'

type FlatItem =
  | { kind: 'athlete'; id: number; label: string; sub?: string }
  | { kind: 'team'; id: number; label: string; sub?: string }
  | { kind: 'competition'; id: number; label: string; sub?: string }

/**
 * GlobalSearch — buscador global del navbar (jugadores + equipos +
 * competiciones). Reemplaza a PlayerSearch (solo jugadores) manteniendo
 * sus convenciones: debounce 300ms, min 2 chars, keyboard nav, focus trap,
 * click-outside. Enter sin highlight → página /buscar?q=.
 */
export function GlobalSearch({ onSelect }: { onSelect?: () => void } = {}) {
  const [query, setQuery] = useState('')
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useFocusTrap(listboxRef, open, { restoreFocus: false, autoFocus: false })

  const search = useCallback(async (q: string) => {
    const term = q.trim()
    if (term.length < 2) {
      setAthletes([])
      setTeams([])
      setCompetitions([])
      setOpen(false)
      return
    }
    try {
      const di = DiContainer.getInstance()
      const [a, t, c] = await Promise.all([
        di.getAthleteRepository().searchAthletes(term).catch(() => []),
        di.getTeamRepository().searchTeams(term).catch(() => []),
        di
          .getCompetitionRepository()
          .getCompetitions()
          .then((list) =>
            list
              .filter(
                (comp) =>
                  comp.displayName.toLowerCase().includes(term.toLowerCase()) ||
                  comp.shortName?.toLowerCase().includes(term.toLowerCase())
              )
              .slice(0, 4)
          )
          .catch(() => []),
      ])
      setAthletes(a.slice(0, 5))
      setTeams(t.slice(0, 5))
      setCompetitions(c)
      setOpen(a.length + t.length + c.length > 0)
      setHighlightIndex(-1)
    } catch {
      setAthletes([])
      setTeams([])
      setCompetitions([])
    }
  }, [])

  const items: FlatItem[] = useMemo(
    () => [
      ...athletes.map(
        (a): FlatItem => ({
          kind: 'athlete',
          id: a.id,
          label: a.name,
          sub: a.position?.name || undefined,
        })
      ),
      ...teams.map(
        (t): FlatItem => ({ kind: 'team', id: t.id, label: t.name, sub: t.shortName || undefined })
      ),
      ...competitions.map(
        (c): FlatItem => ({ kind: 'competition', id: c.id, label: c.displayName, sub: c.countryName || undefined })
      ),
    ],
    [athletes, teams, competitions]
  )

  const go = useCallback(
    (item: FlatItem) => {
      setOpen(false)
      setQuery('')
      onSelect?.()
      if (item.kind === 'athlete') navigate(`/player/${item.id}`)
      else if (item.kind === 'team') navigate(`/equipo/${item.id}`)
      else navigate(`/competicion/${item.id}/standings`)
    },
    [navigate, onSelect]
  )

  const goSearchPage = useCallback(() => {
    const term = query.trim()
    if (term.length < 2) return
    setOpen(false)
    onSelect?.()
    navigate(`/buscar?q=${encodeURIComponent(term)}`)
  }, [query, navigate, onSelect])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(val), 300)
    },
    [search]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (!open || highlightIndex < 0)) {
        e.preventDefault()
        goSearchPage()
        return
      }
      if (!open || items.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
      } else if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault()
        go(items[highlightIndex])
      } else if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    },
    [open, items, highlightIndex, go, goSearchPage]
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sections: { title: string; kind: FlatItem['kind'] }[] = [
    { title: 'Jugadores', kind: 'athlete' },
    { title: 'Equipos', kind: 'team' },
    { title: 'Competiciones', kind: 'competition' },
  ]
  let flatIndex = -1

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (items.length > 0) setOpen(true)
          }}
          placeholder="Buscar jugador, equipo o competición..."
          className="bg-bg-card border-border-card font-body text-text-primary placeholder:text-text-dim focus:border-accent-blue/50 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-colors focus:outline-none"
          aria-label="Búsqueda global"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
      </div>
      {open && items.length > 0 && (
        <ul
          ref={listboxRef}
          className="bg-bg-card border-border-card absolute top-full right-0 left-0 z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border shadow-xl"
          role="listbox"
        >
          {sections.map((section) => {
            const sectionItems = items.filter((i) => i.kind === section.kind)
            if (sectionItems.length === 0) return null
            return (
              <li key={section.kind} role="presentation">
                <p className="font-body text-text-dim px-3 pt-2 pb-1 text-[10px] tracking-wider uppercase">
                  {section.title}
                </p>
                <ul>
                  {sectionItems.map((item) => {
                    flatIndex += 1
                    const idx = flatIndex
                    return (
                      <li
                        key={`${item.kind}-${item.id}`}
                        onClick={() => go(item)}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                          idx === highlightIndex ? 'bg-accent-blue/10' : 'hover:bg-bg-elevated/50'
                        }`}
                        role="option"
                        aria-selected={idx === highlightIndex}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-body text-text-primary block truncate text-sm">
                            {item.label}
                          </span>
                          {item.sub && (
                            <span className="font-body text-text-dim block truncate text-[11px]">
                              {item.sub}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
