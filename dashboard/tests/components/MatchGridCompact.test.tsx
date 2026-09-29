import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { createFinishedGame } from '../factories/game'

describe('MatchGrid compact', () => {
  const games = [
    createFinishedGame({
      id: 1,
      startTime: '2021-03-25T13:45:00Z',
      homeTeam: { id: 10, name: 'Moldavia', score: 1 },
      awayTeam: { id: 20, name: 'Islas Feroe', score: 1 },
    }),
    createFinishedGame({
      id: 2,
      startTime: '2021-03-25T15:00:00Z',
      homeTeam: { id: 30, name: 'Andorra', score: 0 },
      awayTeam: { id: 40, name: 'Albania', score: 2 },
    }),
  ]

  it('no renderiza cabeceras de fecha y muestra todas las tarjetas', () => {
    render(
      <MemoryRouter>
        <MatchGrid games={games} compact />
      </MemoryRouter>
    )
    expect(screen.getByText('Moldavia')).toBeInTheDocument()
    expect(screen.getByText('Albania')).toBeInTheDocument()
    expect(screen.queryByText(/25 DE MARZO/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/2 partidos/i)).not.toBeInTheDocument()
  })

  it('modo normal mantiene cabeceras de fecha', () => {
    render(
      <MemoryRouter>
        <MatchGrid games={games} />
      </MemoryRouter>
    )
    expect(screen.getByText(/25 DE MARZO/i)).toBeInTheDocument()
  })
})
