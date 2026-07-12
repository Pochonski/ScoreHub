import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Athlete } from '@/domain/entities/Athlete'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { useFocusTrap } from '@/presentation/hooks/useFocusTrap'

const repo = DiContainer.getInstance().getAthleteRepository()

export function PlayerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Athlete[]>([])
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useFocusTrap(listboxRef, open, { restoreFocus: false, autoFocus: false })

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    try {
      const data = await repo.searchAthletes(q)
      setResults(data)
      setOpen(data.length > 0)
      setHighlightIndex(-1)
    } catch {
      setResults([])
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(val), 300)
    },
    [search]
  )

  const select = useCallback(
    (athlete: Athlete) => {
      setOpen(false)
      setQuery('')
      navigate(`/player/${athlete.id}`)
    },
    [navigate]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      } else if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault()
        select(results[highlightIndex])
      } else if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    },
    [open, results, highlightIndex, select]
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
            if (results.length > 0) setOpen(true)
          }}
          placeholder="Buscar jugador..."
          className="bg-bg-card border-border-card font-body text-text-primary placeholder:text-text-dim focus:border-accent-blue/50 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-colors focus:outline-none"
          aria-label="Buscar jugador"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
      </div>
      {open && results.length > 0 && (
        <ul
          ref={listboxRef}
          className="bg-bg-card border-border-card absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border shadow-xl"
          role="listbox"
        >
          {results.map((athlete, i) => (
            <li
              key={athlete.id}
              onClick={() => select(athlete)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                i === highlightIndex ? 'bg-accent-blue/10' : 'hover:bg-bg-elevated/50'
              }`}
              role="option"
              aria-selected={i === highlightIndex}
            >
              <div className="bg-bg-elevated h-8 w-8 shrink-0 overflow-hidden rounded-full">
                {athlete.photoUrl ? (
                  <img src={athlete.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="font-display text-text-muted flex h-full w-full items-center justify-center text-sm">
                    {athlete.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-body text-text-primary block truncate text-sm">{athlete.name}</span>
                <span className="font-body text-text-dim block truncate text-[11px]">
                  {athlete.position?.name || ''}
                  {athlete.position?.name && athlete.nationalTeamStatsText ? ' · ' : ''}
                  {athlete.nationalTeamStatsText || ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
