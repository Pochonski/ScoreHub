import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlayerSearch } from '@/presentation/components/explorer/PlayerSearch'
import { useCompetitions } from '@/presentation/hooks/useCompetitions'
import { useActiveCompetition } from '@/presentation/context/ActiveCompetitionContext'

type NavItem = { id: string; label: string; route: (competitionId: number | null) => string }

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'live', label: 'En Vivo', route: () => '/' },
  { id: 'matches', label: 'Partidos', route: () => '/' },
  { id: 'standings', label: 'Tabla', route: cid => cid ? `/competicion/${cid}/standings` : '/competiciones' },
  { id: 'stats', label: 'Estadísticas', route: () => '/analisis' },
  { id: 'news', label: 'Noticias', route: () => '/noticias' },
]

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { competitions } = useCompetitions()
  const { competitionId: activeCompId } = useActiveCompetition()

  const activeComp = activeCompId
    ? competitions.find(c => c.id === activeCompId) ?? null
    : null

  const isActive = (item: NavItem) => {
    const route = item.route(activeCompId)
    if (route === '/') return location.pathname === '/'
    if (route.startsWith('/competicion/')) {
      return location.pathname.startsWith(route.split('/').slice(0, 3).join('/'))
    }
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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
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
              className="bg-bg-card border-border-card animate-fade-in-up absolute top-full right-0 left-auto mt-2 w-72 rounded-xl border p-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  navigate('/competiciones')
                  setDropdownOpen(false)
                }}
                className={`font-body hover:bg-bg-elevated focus-visible flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  location.pathname === '/competiciones' ? 'text-accent-gold' : 'text-text-primary'
                }`}
              >
                <span>Ver todas las competiciones</span>
                <span className="text-text-dim text-xs">→</span>
              </button>
              <div className="bg-border-card/40 my-1 h-px" />
              {competitions.length === 0 && (
                <p className="text-text-muted font-body px-3 py-2 text-xs">
                  Cargando competiciones…
                </p>
              )}
              {competitions.map(c => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    navigate(`/competicion/${c.id}/standings`)
                    setDropdownOpen(false)
                  }}
                  className={`font-body hover:bg-bg-elevated focus-visible flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    activeComp?.id === c.id ? 'bg-accent-gold/10 text-accent-gold' : 'text-text-primary'
                  }`}
                >
                  <span className="truncate">{c.displayName}</span>
                  <span className="text-text-dim shrink-0 font-mono text-[10px]">
                    {c.countryName || ''}
                  </span>
                </button>
              ))}
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
