import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { MatchPlayByPlay } from '@/presentation/components/match-detail/MatchPlayByPlay'
import { apiClient } from '@/data/datasources/ApiClient'

vi.mock('@/data/datasources/ApiClient', () => ({
  apiClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(apiClient.get)

function wrapper(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

const messages = [
  {
    minute: 26, type: 'penalty goal', title: 'Penalty Goal', comment: '¡Gol de penalti!',
    isMajor: true, team: 2, period: '1',
    players: [{ name: 'Viljormur Davidsen', shortName: 'Davidsen', athleteId: 9551, jersey: 3 }],
  },
  {
    minute: 23, type: 'offside', title: null, comment: 'Fuera de juego.',
    isMajor: false, team: 1, period: '1', players: [],
  },
]

describe('MatchPlayByPlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el relato con minutos, destacados y link a jugador', async () => {
    mockedGet.mockResolvedValue(messages)
    render(
      <MemoryRouter>
        {wrapper(<MatchPlayByPlay gameId={4672362} live />)}
      </MemoryRouter>
    )
    expect(await screen.findByText('Relato en vivo')).toBeInTheDocument()
    expect(screen.getByText("26'")).toBeInTheDocument()
    expect(screen.getByText('¡Gol de penalti!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Davidsen/ })).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith('/matches/4672362/playbyplay')
  })

  it('no renderiza nada sin mensajes', async () => {
    mockedGet.mockResolvedValue([])
    render(
      <MemoryRouter>
        {wrapper(<MatchPlayByPlay gameId={1} live={false} />)}
      </MemoryRouter>
    )
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByText('Relato en vivo')).not.toBeInTheDocument()
  })
})
