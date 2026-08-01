import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlayerSearch } from '@/presentation/components/explorer/PlayerSearch'
import { useCompetitions } from '@/presentation/hooks/useCompetitions'
import { useFeaturedGamesByComp } from '@/presentation/hooks/useGames'
import { useActiveCompetition } from '@/presentation/context/ActiveCompetitionContext'
import { competitionLogoUrl } from '@/shared/images'

type NavItem = { id: string; label: string; route: (competitionId: number | null) => string }

/** Logo de la competición con fallback a monograma (iniciales). */
function CompetitionLogo({ id, name }: { id: number; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase() || '?'
  if (failed) {
    return (
      <span className="bg-bg-elevated text-accent-gold font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold">
        {initials}
      </span>
    )
  }
  return (
    <img
      src={competitionLogoUrl(id)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-7 w-7 shrink-0 rounded-md object-contain"
    />
  )
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'matches', label: 'Partidos', route: () => '/' },
  { id: 'standings', label: 'Tabla', route: cid => cid ? `/competicion/${cid}/standings` : '/competiciones' },
  { id: 'stats', label: 'Estadísticas', route: cid => cid ? `/competicion/${cid}/stats` : '/competiciones' },
  { id: 'news', label: 'Noticias', route: cid => cid ? `/competicion/${cid}/news` : '/competiciones' },
]

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { competitions } = useCompetitions()
  const { competitionId: activeCompId } = useActiveCompetition()

  // Ordenar el selector por próximo partido: las que tienen partido en
  // vivo/próximo primero (por fecha), y las que NO tienen (torneos
  // terminados: Copa América, Eurocopa, Mundial) al final por displayOrder.
  const compIds = useMemo(() => competitions.map(c => c.id), [competitions])
  const featuredGamesByComp = useFeaturedGamesByComp(compIds)
  const sortedCompetitions = useMemo(() => {
    const rank = (c: (typeof competitions)[number]): [number, number] => {
      const g = featuredGamesByComp.get(c.id)
      if (g && g.status === 'live') return [0, 0]
      if (g && g.status === 'upcoming') {
        const t = new Date(g.startTime).getTime()
        return [0, Number.isNaN(t) ? Infinity : t]
      }
      return [1, c.displayOrder]
    }
    return [...competitions].sort((a, b) => {
      const [ga, ka] = rank(a)
      const [gb, kb] = rank(b)
      return ga !== gb ? ga - gb : ka - kb
    })
  }, [competitions, featuredGamesByComp])

  const activeComp = activeCompId
    ? competitions.find(c => c.id === activeCompId) ?? null
    : null

  const isActive = (item: NavItem) => {
    const route = item.route(activeCompId)
    if (route === '/') return location.pathname === '/'
    if (route === '/competiciones') return location.pathname === '/competiciones'
    // Rutas de competición: comparar el path completo del tab (…/standings, …/stats, …/news).
    return location.pathname.startsWith(route)
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  return (
    <header className="bg-bg-base/80 border-border-card fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-2 px-4">
        <button
          onClick={() => navigate('/')}
          className="focus-visible flex shrink-0 items-center gap-2"
          aria-label="ScoreHub inicio"
        >
          <span className="text-accent-gold font-display text-2xl font-bold tracking-wide">SCOREHUB</span>
        </button>

        {/* Competition switcher dropdown */}
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="font-body focus-visible text-text-muted hover:text-text-primary flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            <span className="max-w-[140px] truncate sm:max-w-none">
              {activeComp?.shortName || activeComp?.displayName || 'Competiciones'}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="bg-bg-card border-border-card animate-fade-in-up absolute top-full left-0 right-auto z-50 mt-2 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border shadow-xl"
            >
              <div className="overflow-y-auto p-1.5">
                {competitions.length === 0 && (
                  <p className="text-text-muted font-body px-3 py-3 text-center text-xs">
                    Cargando competiciones…
                  </p>
                )}
                {sortedCompetitions.map(c => {
                  const active = activeComp?.id === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        navigate(`/competicion/${c.id}/standings`)
                        setDropdownOpen(false)
                      }}
                      className={`font-body focus-visible flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        active ? 'bg-accent-gold/10' : 'hover:bg-bg-elevated'
                      }`}
                    >
                      <CompetitionLogo id={c.id} name={c.shortName || c.displayName} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-medium ${
                            active ? 'text-accent-gold' : 'text-text-primary'
                          }`}
                        >
                          {c.displayName}
                        </span>
                        {c.countryName && (
                          <span className="text-text-dim block truncate text-[11px]">
                            {c.countryName}
                          </span>
                        )}
                      </span>
                      {active && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent-gold shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M2.5 7.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  navigate('/competiciones')
                  setDropdownOpen(false)
                }}
                className="border-border-card font-body hover:bg-bg-elevated focus-visible flex w-full shrink-0 items-center justify-between border-t px-4 py-2.5 text-left text-xs font-medium text-text-muted transition-colors"
              >
                <span>Ver todas las competiciones</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>

        {/* Navegación desktop (md+). En mobile se usa el BottomNav. */}
        <nav
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
          role="navigation"
          aria-label="Secciones principales"
        >
          {NAV_ITEMS.map((item) => {
            const route = item.route(activeCompId)
            return (
              <button
                key={item.id}
                onClick={() => navigate(route)}
                className={`font-body focus-visible rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive(item)
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-text-muted hover:bg-bg-card hover:text-text-primary'
                }`}
                aria-current={isActive(item) ? 'page' : undefined}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* PlayerSearch: desktop inline, mobile via icon toggle. */}
        <div className="hidden shrink-0 md:block">
          <PlayerSearch />
        </div>

        {/* Botón search en mobile: abre PlayerSearch debajo del header. */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="focus-visible hover:bg-bg-card -mr-2 rounded-lg p-2.5 md:hidden"
          aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar jugador'}
          aria-expanded={searchOpen}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M14 14l4 4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Panel de búsqueda desplegable en mobile. */}
      {searchOpen && (
        <div className="bg-bg-card border-border-card animate-fade-in-up border-b px-4 py-3 md:hidden">
          <PlayerSearch onSelect={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
  )
}
