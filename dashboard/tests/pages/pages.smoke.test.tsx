import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

// jsdom no implementa IntersectionObserver (lo usa el lazy-load/infinite-scroll).
beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  })
})

// apiClient con promesa que nunca resuelve: las queries quedan en loading, las
// pages montan su estado de carga sin crashear ni disparar updates async.
vi.mock('@/data/datasources/ApiClient', () => ({
  apiClient: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(() => new Promise(() => {})),
  },
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ActiveCompetitionProvider } from '@/presentation/context/ActiveCompetitionContext'

import { DashboardPage } from '@/presentation/pages/DashboardPage'
import { CompeticionesPage } from '@/presentation/pages/CompeticionesPage'
import { CompetitionPage } from '@/presentation/pages/CompetitionPage'
import { TeamDetailPage } from '@/presentation/pages/TeamDetailPage'
import { MatchDetailPage } from '@/presentation/pages/MatchDetailPage'
import { PlayerProfilePage } from '@/presentation/pages/PlayerProfilePage'
import { HistoryEditionPage } from '@/presentation/pages/HistoryEditionPage'

function renderAt(path: string, initial: string, element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <ActiveCompetitionProvider>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </ActiveCompetitionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Smoke: cada page debe MONTAR sin lanzar (render() throw = test falla). Catch
// de crashes en render (hooks, dependencias null, errores de compilador React).
describe('pages — smoke (montan sin crashear)', () => {
  it('DashboardPage', () => {
    const { container } = renderAt('/', '/', <DashboardPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('CompeticionesPage', () => {
    const { container } = renderAt('/competiciones', '/competiciones', <CompeticionesPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('CompetitionPage (:id)', () => {
    const { container } = renderAt('/competicion/:id', '/competicion/5930', <CompetitionPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('TeamDetailPage (:id)', () => {
    const { container } = renderAt('/equipo/:id', '/equipo/100', <TeamDetailPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('MatchDetailPage (:id)', () => {
    const { container } = renderAt('/partido/:id', '/partido/123', <MatchDetailPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('PlayerProfilePage (:id)', () => {
    const { container } = renderAt('/jugador/:id', '/jugador/900', <PlayerProfilePage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('HistoryEditionPage (:seasonNum)', () => {
    const { container } = renderAt('/historia/:seasonNum', '/historia/25?competitionId=5930', <HistoryEditionPage />)
    expect(container.firstChild).toBeTruthy()
  })
})
