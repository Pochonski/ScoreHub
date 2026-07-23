import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ActiveCompetitionContext — fuente única de verdad para qué competición
 * está activa en la UI. Se sincroniza con:
 *   1. La URL cuando el usuario navega a /competicion/:id/...
 *   2. La selección del DashboardPage (tabs "Mundial 2026" | "Liga Promerica" | ...)
 *   3. localStorage (persiste entre sesiones)
 *
 * Cualquier consumidor (Navbar, BottomNav, breadcrumbs, links internos)
 * puede leer este valor y construir links relativos a la comp activa
 * (ej. /competicion/{id}/standings) en lugar de hardcodear la Mundial.
 */
type ActiveCompetitionContextValue = {
  /** ID de la comp activa, o null si no hay ninguna seleccionada. */
  competitionId: number | null
  /** Setter explícito — usado por DashboardPage cuando el usuario cambia de tab. */
  setCompetitionId: (id: number | null) => void
}

const ActiveCompetitionContext = createContext<ActiveCompetitionContextValue | null>(null)

const STORAGE_KEY = 'scorehub.activeCompetitionId'

function readFromUrl(pathname: string): number | null {
  const m = pathname.match(/^\/competicion\/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function readFromStorage(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const id = parseInt(raw, 10)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

function writeToStorage(id: number | null) {
  if (typeof window === 'undefined') return
  try {
    if (id == null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, String(id))
    }
  } catch {
    /* ignore */
  }
}

export function ActiveCompetitionProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const urlId = readFromUrl(location.pathname)

  // Inicializa desde URL > localStorage. La URL gana si está en /competicion/:id/...
  const [competitionId, setCompetitionIdState] = useState<number | null>(() => {
    return urlId ?? readFromStorage()
  })

  // Sincronizar cuando cambia la URL.
  useEffect(() => {
    if (urlId != null) {
      setCompetitionIdState(urlId)
      writeToStorage(urlId)
    }
  }, [urlId])

  const setCompetitionId = (id: number | null) => {
    setCompetitionIdState(id)
    writeToStorage(id)
  }

  const value = useMemo(
    () => ({ competitionId, setCompetitionId }),
    [competitionId]
  )

  return (
    <ActiveCompetitionContext.Provider value={value}>
      {children}
    </ActiveCompetitionContext.Provider>
  )
}

export function useActiveCompetition(): ActiveCompetitionContextValue {
  const ctx = useContext(ActiveCompetitionContext)
  if (!ctx) {
    return { competitionId: null, setCompetitionId: () => {} }
  }
  return ctx
}
