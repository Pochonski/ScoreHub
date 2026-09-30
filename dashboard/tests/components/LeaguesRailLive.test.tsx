import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LeaguesRail } from '@/presentation/components/dashboard/LeaguesRail'
import { createLiveGame, createFinishedGame } from '../factories/game'

const comps = [
  { id: 7016, displayName: 'Liga de las Naciones - UEFA', shortName: 'Nations League', countryName: 'Europa', displayOrder: 1 },
]

const baseProps = {
  competitions: comps,
  scope: { kind: 'one', id: 7016 } as const,
  onScopeChange: vi.fn(),
  liveCount: 2,
  onSelectGame: vi.fn(),
  onFilterChange: vi.fn(),
  dateOffset: 0,
  onDateChange: vi.fn(),
}

const liveGames = [
  createLiveGame({
    id: 1,
    minute: 35,
    homeTeam: { id: 5031, name: 'Moldavia', score: 0 },
    awayTeam: { id: 5058, name: 'Islas Feroe', score: 1 },
  }),
  createLiveGame({
    id: 2,
    minute: 20,
    homeTeam: { id: 10, name: 'Finlandia', score: 0 },
    awayTeam: { id: 20, name: 'Bielorrusia', score: 0 },
  }),
]

describe('LeaguesRail — modo Vivo', () => {
  it('muestra los partidos en vivo con minuto', () => {
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={liveGames} filter="live" />
      </MemoryRouter>
    )
    expect(screen.getByText('Moldavia')).toBeInTheDocument()
    expect(screen.getByText("35'")).toBeInTheDocument()
    expect(screen.queryByText('Sin partidos para esta fecha')).not.toBeInTheDocument()
  })

  it('mensaje propio cuando no hay vivos', () => {
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={[]} filter="live" liveCount={0} />
      </MemoryRouter>
    )
    expect(screen.getByText('Sin partidos en vivo ahora mismo')).toBeInTheDocument()
  })

  it('atenúa el navegador de fecha en modo Vivo', () => {
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={liveGames} filter="live" />
      </MemoryRouter>
    )
    const nav = screen.getByTitle('En modo Vivo la fecha no aplica')
    expect(nav.className).toMatch(/pointer-events-none/)
  })

  it('modo Por hora conserva mensaje de fecha y lista filtrada', () => {
    const finished = [
      createFinishedGame({
        id: 3,
        homeTeam: { id: 1, name: 'España', score: 2 },
        awayTeam: { id: 2, name: 'Croacia', score: 1 },
      }),
    ]
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={finished} filter="all" liveCount={0} />
      </MemoryRouter>
    )
    expect(screen.getByText('España')).toBeInTheDocument()
    expect(screen.getByText('Por hora')).toBeInTheDocument()
  })

  it('en modo Vivo el tab Por hora sigue clicable (no hereda pointer-events-none)', () => {
    const onFilterChange = vi.fn()
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={liveGames} filter="live" onFilterChange={onFilterChange} />
      </MemoryRouter>
    )
    const porHora = screen.getByRole('button', { name: 'Por hora' })
    // Ningún ancestro del toggle debe bloquear el puntero.
    let el: HTMLElement | null = porHora
    while (el) {
      expect(el.className).not.toMatch(/pointer-events-none/)
      el = el.parentElement
    }
    fireEvent.click(porHora)
    expect(onFilterChange).toHaveBeenCalledWith('all')
  })

  it('el tab Vivo dispara onFilterChange live', () => {
    const onFilterChange = vi.fn()
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={[]} filter="all" onFilterChange={onFilterChange} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /Vivo/ }))
    expect(onFilterChange).toHaveBeenCalledWith('live')
  })
})
