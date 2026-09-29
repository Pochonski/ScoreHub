import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MatchPreviewEmbed, findSharedGroup } from '@/presentation/components/match-detail/MatchPreviewEmbed'
import { useMatchPreview } from '@/presentation/hooks/useMatchPreview'
import { useStandings } from '@/presentation/hooks/useStandings'
import type { StandingGroup } from '@/domain/entities/Standing'

vi.mock('@/presentation/hooks/useMatchPreview', () => ({
  useMatchPreview: vi.fn(),
}))
vi.mock('@/presentation/hooks/useStandings', () => ({
  useStandings: vi.fn(),
}))

const mockedPreview = vi.mocked(useMatchPreview)
const mockedStandings = vi.mocked(useStandings)

const group = {
  name: 'Grupo C',
  displayName: 'Liga C · Grupo 3',
  rows: [
    { position: 1, team: { id: 100, name: 'Eslovaquia' }, played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 0, goalDiff: 4, points: 6, recentForm: [] },
    { position: 2, team: { id: 5058, name: 'Islas Feroe' }, played: 2, won: 0, drawn: 2, lost: 0, goalsFor: 2, goalsAgainst: 2, goalDiff: 0, points: 2, recentForm: [] },
    { position: 4, team: { id: 5031, name: 'Moldavia' }, played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDiff: -2, points: 1, recentForm: [] },
  ],
} as unknown as StandingGroup

const previewBase = {
  gameId: 4672362,
  competitionId: 7016,
  homeTeamId: 5031,
  awayTeamId: 5058,
  game: null,
  form: { home: [], away: [] },
  h2h: { h2hGames: [], homeRecent: [], awayRecent: [] },
  table: {
    home: { position: 4, played: 2, won: 0, drawn: 1, lost: 1, points: 1 },
    away: { position: 2, played: 2, won: 0, drawn: 2, lost: 0, points: 2 },
  },
  trends: [],
  predictions: [],
}

const props = {
  gameId: 4672362,
  homeTeamId: 5031,
  awayTeamId: 5058,
  homeName: 'Moldavia',
  awayName: 'Islas Feroe',
  competitionId: 7016,
}

describe('findSharedGroup', () => {
  it('encuentra el grupo con ambos equipos', () => {
    expect(findSharedGroup([group], 5031, 5058)?.name).toBe('Grupo C')
  })
  it('null si están en grupos distintos o falta uno', () => {
    const other = { ...group, name: 'Grupo X', rows: [group.rows[0]] } as StandingGroup
    expect(findSharedGroup([other], 5031, 5058)).toBeNull()
    expect(findSharedGroup([group], 5031, 9999)).toBeNull()
    expect(findSharedGroup([], 5031, 5058)).toBeNull()
  })
})

describe('MatchPreviewEmbed — mini-tabla vs barras', () => {
  it('muestra la mini-tabla del grupo cuando comparten grupo', () => {
    mockedPreview.mockReturnValue({ preview: previewBase, loading: false, error: null, refetch: () => {} } as never)
    mockedStandings.mockReturnValue({ groups: [group], loading: false, error: null, refetch: () => {} } as never)
    render(
      <MemoryRouter>
        <MatchPreviewEmbed {...props} />
      </MemoryRouter>
    )
    expect(screen.getByText('Liga C · Grupo 3')).toBeInTheDocument()
    expect(screen.getByText('Eslovaquia')).toBeInTheDocument()
    expect(screen.queryByText('Posición')).not.toBeInTheDocument()
  })

  it('usa barras cuando no comparten grupo', () => {
    mockedPreview.mockReturnValue({ preview: previewBase, loading: false, error: null, refetch: () => {} } as never)
    mockedStandings.mockReturnValue({ groups: [], loading: false, error: null, refetch: () => {} } as never)
    render(
      <MemoryRouter>
        <MatchPreviewEmbed {...props} />
      </MemoryRouter>
    )
    expect(screen.getByText('Posición')).toBeInTheDocument()
    expect(screen.queryByText('Liga C · Grupo 3')).not.toBeInTheDocument()
  })

  it('muestra la mini-tabla aunque el bundle no traiga tabla', () => {
    mockedPreview.mockReturnValue({
      preview: { ...previewBase, table: { home: null, away: null } },
      loading: false,
      error: null,
      refetch: () => {},
    } as never)
    mockedStandings.mockReturnValue({ groups: [group], loading: false, error: null, refetch: () => {} } as never)
    render(
      <MemoryRouter>
        <MatchPreviewEmbed {...props} />
      </MemoryRouter>
    )
    expect(screen.getByText('Liga C · Grupo 3')).toBeInTheDocument()
    expect(screen.queryByText('Posición')).not.toBeInTheDocument()
  })
})
