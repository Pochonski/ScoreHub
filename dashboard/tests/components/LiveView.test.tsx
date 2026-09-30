import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { groupLiveByCompetition, formatLiveMinute } from '@/presentation/components/dashboard/liveUtils'
import { LiveCenterGroups } from '@/presentation/components/dashboard/LiveCenterGroups'
import { createLiveGame } from '../factories/game'

const comps = [
  { id: 7016, displayName: 'Nations League', shortName: 'Nations League', displayOrder: 1 },
  { id: 11, displayName: 'LaLiga', shortName: 'LaLiga', displayOrder: 2 },
]

const moldavia = createLiveGame({
  id: 1, competitionId: 7016, minute: 35,
  homeTeam: { id: 5031, name: 'Moldavia', score: 0 },
  awayTeam: { id: 5058, name: 'Islas Feroe', score: 1 },
})
const finlandia = createLiveGame({
  id: 2, competitionId: 7016, minute: 20,
  homeTeam: { id: 10, name: 'Finlandia', score: 0 },
  awayTeam: { id: 20, name: 'Bielorrusia', score: 0 },
})
const espana = createLiveGame({
  id: 3, competitionId: 11, minute: 60,
  homeTeam: { id: 5050, name: 'España', score: 1 },
  awayTeam: { id: 5055, name: 'Croacia', score: 1 },
})

describe('groupLiveByCompetition', () => {
  it('agrupa por liga en orden dado y ordena por minuto desc', () => {
    const groups = groupLiveByCompetition([finlandia, espana, moldavia], comps)
    expect(groups).toHaveLength(2)
    expect(groups[0].competition.id).toBe(7016)
    expect(groups[0].games.map((g) => g.id)).toEqual([1, 2])
    expect(groups[1].competition.id).toBe(11)
  })

  it('excluye ligas sin vivos y manda huérfanos al fallback', () => {
    const orphan = createLiveGame({ id: 9, competitionId: undefined })
    const groups = groupLiveByCompetition([moldavia, orphan], comps, comps[1])
    expect(groups).toHaveLength(2)
    expect(groups[1].games.map((g) => g.id)).toEqual([9])
  })

  it('descarta huérfanos sin fallback', () => {
    const orphan = createLiveGame({ id: 9, competitionId: undefined })
    expect(groupLiveByCompetition([orphan], comps)).toEqual([])
  })
})

describe('formatLiveMinute', () => {
  it('oculta minutos negativos o nulos', () => {
    expect(formatLiveMinute(-1)).toBeNull()
    expect(formatLiveMinute(0)).toBeNull()
    expect(formatLiveMinute(undefined)).toBeNull()
    expect(formatLiveMinute(35)).toBe("35'")
  })
})

describe('LiveCenterGroups', () => {
  it('renderiza secciones por liga con conteo', () => {
    const groups = groupLiveByCompetition([moldavia, finlandia, espana], comps)
    render(
      <MemoryRouter>
        <LiveCenterGroups groups={groups} loading={false} onSelectGame={() => {}} onShowUpcoming={() => {}} />
      </MemoryRouter>
    )
    expect(screen.getByText('Nations League')).toBeInTheDocument()
    expect(screen.getByText('LaLiga')).toBeInTheDocument()
    expect(screen.getByText('Moldavia')).toBeInTheDocument()
    expect(screen.getByText('España')).toBeInTheDocument()
  })

  it('sin vivos muestra mensaje y botón a próximos', () => {
    const onShowUpcoming = vi.fn()
    render(
      <MemoryRouter>
        <LiveCenterGroups groups={[]} loading={false} onSelectGame={() => {}} onShowUpcoming={onShowUpcoming} />
      </MemoryRouter>
    )
    expect(screen.getByText('Sin partidos en vivo ahora mismo')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Ver próximos partidos/))
    expect(onShowUpcoming).toHaveBeenCalled()
  })
})
