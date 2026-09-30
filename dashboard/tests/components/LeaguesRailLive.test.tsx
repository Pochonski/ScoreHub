import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LeaguesRail } from '@/presentation/components/dashboard/LeaguesRail'
import { createLiveGame, createFinishedGame } from '../factories/game'

const comps = [
  { id: 7016, displayName: 'Liga de las Naciones - UEFA', shortName: 'Nations League', countryName: 'Europa', displayOrder: 1 },
  { id: 11, displayName: 'LaLiga', shortName: 'LaLiga', countryName: 'España', displayOrder: 2 },
]

const baseProps = {
  competitions: comps,
  scope: { kind: 'one', id: 7016 } as const,
  onScopeChange: vi.fn(),
  liveGroups: [],
  liveLoading: false,
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
  const groups = [{ competition: comps[0], games: liveGames }]

  it('muestra solo ligas con vivos, expandidas y con minuto', () => {
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={[]} liveGroups={groups} filter="live" />
      </MemoryRouter>
    )
    expect(screen.getByText('Moldavia')).toBeInTheDocument()
    expect(screen.getByText("35'")).toBeInTheDocument()
    // LaLiga no tiene vivos: no se lista.
    expect(screen.queryByText('LaLiga')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin partidos para esta fecha')).not.toBeInTheDocument()
  })

  it('minuto negativo muestra EN VIVO sin número', () => {
    const neg = [
      createLiveGame({
        id: 9,
        minute: -1,
        homeTeam: { id: 109, name: 'Aston Villa', score: null },
        awayTeam: { id: 104, name: 'Arsenal', score: null },
      }),
    ]
    render(
      <MemoryRouter>
        <LeaguesRail
          {...baseProps}
          games={[]}
          liveGroups={[{ competition: comps[1], games: neg }]}
          filter="live"
        />
      </MemoryRouter>
    )
    expect(screen.queryByText("-1'")).not.toBeInTheDocument()
    expect(screen.getAllByText('EN VIVO').length).toBeGreaterThan(0)
  })

  it('click en liga con vivos cambia scope y sale de Vivo', () => {
    const onScopeChange = vi.fn()
    const onFilterChange = vi.fn()
    render(
      <MemoryRouter>
        <LeaguesRail
          {...baseProps}
          games={[]}
          liveGroups={groups}
          filter="live"
          onScopeChange={onScopeChange}
          onFilterChange={onFilterChange}
        />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /Nations League/ }))
    expect(onScopeChange).toHaveBeenCalledWith({ kind: 'one', id: 7016 })
    expect(onFilterChange).toHaveBeenCalledWith('all')
  })

  it('mensaje propio cuando no hay vivos', () => {
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={[]} liveGroups={[]} filter="live" liveCount={0} />
      </MemoryRouter>
    )
    expect(screen.getByText('Sin partidos en vivo ahora mismo')).toBeInTheDocument()
  })

  it('atenúa el navegador de fecha en modo Vivo', () => {
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={[]} liveGroups={groups} filter="live" />
      </MemoryRouter>
    )
    const nav = screen.getByTitle('En modo Vivo la fecha no aplica')
    expect(nav.className).toMatch(/pointer-events-none/)
  })

  it('modo Por hora conserva mensaje de fecha y lista filtrada', () => {
    const finished = [
      createFinishedGame({
        id: 3,
        homeTeam: { id: 1, name: 'Portugal', score: 2 },
        awayTeam: { id: 2, name: 'Alemania', score: 1 },
      }),
    ]
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={finished} filter="all" liveCount={0} />
      </MemoryRouter>
    )
    expect(screen.getByText('Portugal')).toBeInTheDocument()
    expect(screen.getByText('Por hora')).toBeInTheDocument()
  })

  it('en modo Vivo el tab Por hora sigue clicable (no hereda pointer-events-none)', () => {
    const onFilterChange = vi.fn()
    render(
      <MemoryRouter>
        <LeaguesRail {...baseProps} games={[]} liveGroups={groups} filter="live" onFilterChange={onFilterChange} />
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
