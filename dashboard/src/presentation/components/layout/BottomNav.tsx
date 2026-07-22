import { useNavigate, useLocation } from 'react-router-dom'

/**
 * BottomNav — barra de navegación inferior fija, visible solo en mobile (<md).
 *
 * Reemplaza al drawer hamburguesa para una UX tipo app nativa
 * (Instagram/Twitter). En md+ desaparece y se usa el navbar superior.
 *
 * Notas de diseño:
 * - h-16 (64px) + safe-area-inset-bottom para iOS.
 * - Cada ítem: ícono 24px + label text-[10px]; target total >= 48px.
 * - Active state en accent-blue.
 */
const NAV_ITEMS = [
  {
    id: 'live',
    label: 'En Vivo',
    route: '/',
    icon: (
      <path d="M8 5v11l8.5-5.5L8 5z" fill="currentColor" stroke="none" />
    ),
  },
  {
    id: 'matches',
    label: 'Partidos',
    route: '/?filter=all',
    matchRoute: '/',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <line x1="12" y1="6" x2="12" y2="18" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
  },
  {
    id: 'standings',
    label: 'Tabla',
    route: '/competiciones',
    icon: (
      <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="14" y2="18" />
      </>
    ),
  },
  {
    id: 'stats',
    label: 'Stats',
    route: '/analisis',
    icon: (
      <>
        <line x1="5" y1="20" x2="5" y2="14" />
        <line x1="12" y1="20" x2="12" y2="8" />
        <line x1="19" y1="20" x2="19" y2="11" />
        <line x1="3" y1="20" x2="21" y2="20" />
      </>
    ),
  },
  {
    id: 'news',
    label: 'Noticias',
    route: '/noticias',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <line x1="7" y1="9" x2="13" y2="9" />
        <line x1="7" y1="13" x2="13" y2="13" />
        <line x1="16" y1="9" x2="16" y2="13" />
      </>
    ),
  },
] as const

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    // Caso especial: tanto 'live' como 'matches' apuntan a la home.
    if (item.id === 'live' || item.id === 'matches') return location.pathname === '/'
    // 'Tabla' está activo tanto en /competiciones como en /competicion/:id/...
    if (item.id === 'standings') {
      return (
        location.pathname === '/competiciones' ||
        location.pathname.startsWith('/competicion/')
      )
    }
    return location.pathname.startsWith(item.route)
  }

  const handleNavigate = (item: (typeof NAV_ITEMS)[number]) => {
    navigate(item.route)
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="bg-bg-card/95 border-border-card safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => handleNavigate(item)}
                aria-current={active ? 'page' : undefined}
                className={`focus-visible flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active
                    ? 'text-accent-blue'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                <span className="font-body text-[10px] font-medium tracking-wide">
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
