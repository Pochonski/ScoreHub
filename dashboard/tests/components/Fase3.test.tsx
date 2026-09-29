import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { findTablePosition } from '@/presentation/pages/TeamDetailPage'
import { teamResult } from '@/presentation/pages/TeamDetailPage'
import { parseOutrights, mapRawGames } from '@/presentation/components/competition/analysisUtils'
import { StatsTab } from '@/presentation/components/competition/StatsTab'
import { useTournamentStats } from '@/presentation/hooks/useTournamentStats'
import type { StandingGroup } from '@/domain/entities/Standing'
import type { RawGame } from '@/domain/entities/RawGame'

vi.mock('@/presentation/hooks/useTournamentStats', () => ({
  useTournamentStats: vi.fn(),
}))

const mockedStats = vi.mocked(useTournamentStats)

describe('findTablePosition', () => {
  const groups = [
    {
      name: 'Grupo A',
      displayName: 'Liga B · Grupo 2',
      rows: [
        { position: 1, team: { id: 5026, name: 'Hungría' }, played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDiff: 1, points: 4, recentForm: [] },
        { position: 2, team: { id: 5037, name: 'Irlanda del Norte' }, played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 0, goalDiff: 1, points: 3, recentForm: [] },
      ],
    },
  ] as unknown as StandingGroup[]

  it('encuentra posición, puntos y grupo del equipo', () => {
    expect(findTablePosition(groups, 5037)).toEqual({ position: 2, points: 3, group: 'Liga B · Grupo 2' })
  })

  it('devuelve null si el equipo no está', () => {
    expect(findTablePosition(groups, 999)).toBeNull()
    expect(findTablePosition([], 5037)).toBeNull()
  })
})

describe('teamResult — G/E/P desde el marcador', () => {
  const mk = (hs: number, as: number, homeId = 131, awayId = 20): RawGame =>
    ({
      id: 1,
      startTime: '2026-09-01T00:00:00Z',
      statusGroup: 4,
      statusText: 'Fin',
      homeCompetitor: { id: homeId, name: 'A' },
      awayCompetitor: { id: awayId, name: 'B' },
      scores: [hs, as],
    }) as RawGame

  it('local que gana, visita que pierde, empate', () => {
    expect(teamResult(mk(2, 1), 131)?.label).toBe('G')
    expect(teamResult(mk(2, 1, 20, 131), 131)?.label).toBe('P')
    expect(teamResult(mk(1, 1), 131)?.label).toBe('E')
  })

  it('ignora outcome y scores desconocidos', () => {
    // Elche 2-3 Madrid con outcome=1 (relativo al equipo): por marcador es G.
    expect(teamResult({ ...mk(2, 3, 10, 131), outcome: 1 }, 131)?.label).toBe('G')
    expect(teamResult({ ...mk(2, 1), scores: [-1, -1] }, 131)).toBeNull()
    expect(teamResult({ ...mk(2, 1), scores: undefined }, 131)).toBeNull()
  })
})
describe('parseOutrights', () => {
  it('parsea lista de cuotas', () => {
    expect(
      parseOutrights([{ name: 'España', odd: 4.5 }, { name: 'Francia', odd: 5 }])
    ).toEqual([
      { label: 'España', value: '4.5' },
      { label: 'Francia', value: '5' },
    ])
  })

  it('parsea objeto anidado y mapa plano', () => {
    expect(parseOutrights({ outrights: [{ team: 'QPR', price: '11/2' }] })).toEqual([
      { label: 'QPR', value: '11/2' },
    ])
    expect(parseOutrights({ España: 4.5, Francia: 5 })).toEqual([
      { label: 'España', value: '4.5' },
      { label: 'Francia', value: '5' },
    ])
  })

  it('devuelve null con datos vacíos o metadata', () => {
    expect(parseOutrights({})).toBeNull()
    expect(parseOutrights(null)).toBeNull()
    expect(parseOutrights({ updatedAt: 'ayer' })).toBeNull()
  })
})

describe('mapRawGames', () => {
  it('descarta raws inválidos sin tirar', () => {
    const valid = {
      id: 1, startTime: '2026-10-01T00:00:00Z', statusGroup: 2, statusText: 'Prog.',
      homeCompetitor: { id: 10, name: 'A' }, awayCompetitor: { id: 20, name: 'B' },
    } as RawGame
    expect(mapRawGames([valid, { id: 'x' } as unknown as RawGame])).toHaveLength(1)
  })
})

describe('StatsTab — cards deshabilitadas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const base = { teamOfWeek: null, loading: false }

  it('muestra mensaje por categoría vacía en vez de ocultar', () => {
    mockedStats.mockReturnValue({
      ...base,
      scorers: [{ athleteId: 1, name: 'Goleador', teamName: 'QPR', value: 9 }],
      assists: [],
      ratings: [],
    } as never)
    render(
      <MemoryRouter>
        <StatsTab competitionId={7016} />
      </MemoryRouter>
    )
    expect(screen.getByText('Goleadores')).toBeInTheDocument()
    expect(screen.getByText('Esta competición no publica asistencias')).toBeInTheDocument()
    expect(screen.getByText('Esta competición no publica valoraciones')).toBeInTheDocument()
  })

  it('mensaje global solo cuando todo está vacío', () => {
    mockedStats.mockReturnValue({ ...base, scorers: [], assists: [], ratings: [] } as never)
    render(
      <MemoryRouter>
        <StatsTab competitionId={7016} />
      </MemoryRouter>
    )
    expect(screen.getByText('Estadísticas del torneo no disponibles')).toBeInTheDocument()
  })
})
