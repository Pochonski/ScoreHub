import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mapAthlete } from '@/data/mappers/AthleteMapper'
import {
  PlayerProfile,
} from '@/presentation/components/explorer/PlayerProfile'
import {
  parseCareerTables,
  buildTeamTimeline,
  contractYear,
} from '@/presentation/components/explorer/playerProfileUtils'
import type { Athlete } from '@/domain/entities/Athlete'

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const baseAthlete: Athlete = {
  id: 150096,
  name: 'Pierce Charles',
  position: { id: 1, name: 'Portero' },
  age: 21,
}

describe('AthleteMapper (campos nuevos)', () => {
  const raw = {
    id: 150096,
    name: 'Pierce Charles',
    age: 21,
    position: { id: 1, name: 'Portero' },
    jerseyNum: 1,
    nationalityName: 'Irlanda del Norte',
    clubId: 18,
    onLoanFrom: 25,
    onLoanUntil: '2027-07-01T00:00:00-06:00',
    playerDetails: [
      { title: '21/07/2005', value: '21 años' },
      { title: 'Altura', value: '1.86' },
      { title: 'Pie hábil', value: 'Derecha' },
    ],
    highlightStats: [
      {
        name: 'Championship',
        stats: [
          { name: 'Apariciones', shortName: 'Apariciones', value: '8/8', isTop: true },
          { name: 'Salvadas', shortName: 'Salvadas', value: '18', isTop: true },
        ],
      },
    ],
    lastMatches: {
      games: [
        {
          game: {
            id: 4672367,
            startTime: '2026-09-28T12:45:00-06:00',
            statusText: 'Finalizado',
            competitionDisplayName: 'Liga de las Naciones - UEFA',
            homeCompetitor: { id: 5037, name: 'Irlanda del Norte', score: 0 },
            awayCompetitor: { id: 5026, name: 'Hungría', score: 0 },
          },
          played: true,
          athleteStats: [
            { logo: false, type: 229, value: '90' },
            {},
            { logo: false, type: 0, value: '7.3', bgColor: '#61B000' },
          ],
        },
        {
          game: { id: 4805957, homeCompetitor: { name: 'Salford City', score: 1 }, awayCompetitor: { name: 'Sheffield Wed', score: 2 } },
          played: false,
          didNotPlayReason: 'Estadísticas no disponibles',
          athleteStats: [],
        },
      ],
    },
  }

  it('mapea dorsal, nacionalidad, ficha, destacados y últimos partidos', () => {
    const a = mapAthlete(raw)
    expect(a.jerseyNum).toBe(1)
    expect(a.nationalityName).toBe('Irlanda del Norte')
    expect(a.onLoanFrom).toBe(25)
    expect(a.playerDetails).toHaveLength(3)
    expect(a.playerDetails?.[1]).toEqual({ title: 'Altura', value: '1.86' })
    expect(a.highlightStats?.[0].name).toBe('Championship')
    expect(a.highlightStats?.[0].stats[0]).toMatchObject({ name: 'Apariciones', value: '8/8' })
    expect(a.lastMatches).toHaveLength(2)
    expect(a.lastMatches?.[0]).toMatchObject({
      gameId: 4672367,
      played: true,
      minutes: 90,
      rating: { value: '7.3', bgColor: '#61B000' },
    })
    expect(a.lastMatches?.[1].played).toBe(false)
  })

  it('tolera payloads sin los campos nuevos', () => {
    const a = mapAthlete({ id: 1, name: 'X' })
    expect(a.playerDetails).toBeUndefined()
    expect(a.highlightStats).toBeUndefined()
    expect(a.lastMatches).toBeUndefined()
  })
})

describe('parseCareerTables', () => {
  const stats = {
    categories: [],
    tables: [
      {
        rows: [
          {
            title: 'Championship',
            values: [
              { value: '8', columnNum: 5 },
              { value: '2', columnNum: 12 },
              { value: '18', columnNum: 13 },
            ],
          },
        ],
      },
    ],
    legend: [{ title: 'Apariciones' }, { title: 'Vallas invictas' }, { title: 'Salvadas' }],
  }

  it('mapea values[i] ↔ legend[i] por posición', () => {
    const blocks = parseCareerTables(stats)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].competition).toBe('Championship')
    expect(blocks[0].stats).toEqual([
      { label: 'Apariciones', value: '8' },
      { label: 'Vallas invictas', value: '2' },
      { label: 'Salvadas', value: '18' },
    ])
  })

  it('devuelve [] con tablas vacías o ausentes', () => {
    expect(parseCareerTables({ categories: [], tables: [] })).toEqual([])
    expect(parseCareerTables({} as never)).toEqual([])
  })
})

describe('buildTeamTimeline + contractYear', () => {
  it('fusiona traspasos consecutivos del mismo club con Hasta YYYY', () => {
    const stints = buildTeamTimeline([
      { date: '2026-07-01T00:00:00-06:00', competitorId: 18, competitorName: 'QPR', competitorBadge: 'qpr.png', transferTitle: 'Cesión', contractUntil: '01-07-2027 00:00' },
      { date: '2022-10-17T00:00:00-06:00', competitorId: 25, competitorName: 'Sheffield Wed', competitorBadge: 'sw.png', transferTitle: 'Transferencia' },
    ])
    expect(stints).toHaveLength(2)
    expect(stints?.[0]).toMatchObject({ team: 'QPR', label: 'Cesión', endLabel: 'Presente' })
    expect(contractYear(stints?.[0].contractUntil)).toBe('2027')
    expect(stints?.[1]).toMatchObject({ team: 'Sheffield Wed', endLabel: 'jul 2026' })
  })

  it('contractYear soporta ISO y dd-mm-yyyy', () => {
    expect(contractYear('2027-07-01')).toBe('2027')
    expect(contractYear('01-07-2027 00:00')).toBe('2027')
    expect(contractYear(undefined)).toBeNull()
  })
})

describe('PlayerProfile', () => {
  it('renderiza hero con dorsal, club, ficha, destacados y últimos partidos', () => {
    const athlete: Athlete = {
      ...baseAthlete,
      jerseyNum: 1,
      clubId: 18,
      nationalityName: 'Irlanda del Norte',
      playerDetails: [{ title: 'Altura', value: '1.86' }],
      highlightStats: [{ name: 'Championship', stats: [{ name: 'Salvadas', value: '18', isTop: true }] }],
      lastMatches: [
        {
          gameId: 4672367,
          startTime: '2026-09-28T12:45:00-06:00',
          competitionName: 'Nations League',
          home: { name: 'Irlanda del Norte', score: 0 },
          away: { name: 'Hungría', score: 0 },
          played: true,
          minutes: 90,
          rating: { value: '7.3', bgColor: '#61B000' },
        },
      ],
    }
    renderWithRouter(
      <PlayerProfile
        athlete={athlete}
        career={[]}
        trophies={[]}
        transfers={[
          { date: '2026-07-01T00:00:00-06:00', competitorId: 18, competitorName: 'QPR', transferTitle: 'Cesión', contractUntil: '01-07-2027 00:00' },
        ]}
      />
    )
    expect(screen.getByText('Pierce Charles')).toBeInTheDocument()
    expect(screen.getByTitle('Dorsal')).toHaveTextContent('1')
    expect(screen.getAllByText('QPR')).toHaveLength(2) // chip club + trayectoria
    expect(screen.getByText('Irlanda del Norte')).toBeInTheDocument()
    expect(screen.getByText('Cedido')).toBeInTheDocument()
    expect(screen.getByText('1.86')).toBeInTheDocument()
    expect(screen.getByText('Destacados')).toBeInTheDocument()
    expect(screen.getByText('Salvadas')).toBeInTheDocument()
    expect(screen.getByText('Últimos partidos')).toBeInTheDocument()
    expect(screen.getByText('7.3')).toBeInTheDocument()
    expect(screen.getByText('Trayectoria')).toBeInTheDocument()
    expect(screen.queryByText('Carrera')).not.toBeInTheDocument()
    expect(screen.queryByText('Transferencias')).not.toBeInTheDocument()
  })
})
