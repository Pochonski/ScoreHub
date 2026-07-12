import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlayerSearch } from '@/presentation/components/explorer/PlayerSearch'

const NAV_ITEMS = [
  { id: 'live', label: 'En Vivo', route: '/' },
  { id: 'matches', label: 'Partidos', route: '/' },
  { id: 'standings', label: 'Tabla', route: '/competicion' },
  { id: 'stats', label: 'Estadísticas', route: '/analisis' },
  { id: 'news', label: 'Noticias', route: '/analisis' },
] as const

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.route === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.route)
  }

  const handleNavigate = (item: (typeof NAV_ITEMS)[number]) => {
    navigate(item.route)
    setMobileOpen(false)
  }

  return (
    <header className="bg-bg-base/80 border-border-card fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <button onClick={() => navigate('/')} className="focus-visible flex shrink-0 items-center gap-2">
          <span className="text-accent-gold font-display text-2xl font-bold tracking-wide">MUNDIALISTA</span>
          <span className="text-text-muted font-body hidden text-xs font-light sm:inline">2026</span>
        </button>

        <nav
          className="hidden items-center gap-1 md:flex"
          role="navigation"
          aria-label="Secciones principales"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item)}
              className={`font-body focus-visible rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                isActive(item)
                  ? 'text-accent-blue bg-accent-blue/10'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-card'
              }`}
              aria-current={isActive(item) ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:block">
          <PlayerSearch />
        </div>

        <button
          className="hover:bg-bg-card focus-visible rounded-lg p-2 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
          <nav
            className="bg-bg-card border-border-card animate-fade-in-up fixed top-14 right-0 left-0 z-50 border-b md:hidden"
            role="navigation"
            aria-label="Secciones principales"
          >
            <div className="space-y-3 p-4">
              <PlayerSearch />
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item)}
                    className={`font-body focus-visible w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                      isActive(item)
                        ? 'text-accent-blue bg-accent-blue/10'
                        : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
