import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mapRawGame } from '@/data/mappers/GameMapper'
import { MatchTimeline } from '@/presentation/components/match-detail/MatchTimeline'
import type { RawGame } from '@/domain/entities/RawGame'

const rawSuggestion: RawGame = {
  id: 4672319,
  competitionId: 7016,
  seasonNum: 5,
  stageName: 'Fase de grupos',
  roundName: 'Fecha',
  groupNum: 9,
  startTime: '2026-10-05T12:45:00-06:00',
  statusGroup: 2,
  statusText: 'Prog.',
  homeCompetitor: { id: 5060, name: 'Rumania' },
  awayCompetitor: { id: 2371, name: 'Suecia' },
  scores: [-1, -1],
}

describe('mapRawGame', () => {
  it('mapea sugerencia upcoming sin marcador (-1 → undefined)', () => {
    const g = mapRawGame(rawSuggestion)
    expect(g.id).toBe(4672319)
    expect(g.competitionId).toBe(7016)
    expect(g.status).toBe('upcoming')
    expect(g.groupNum).toBe(9)
    expect(g.homeTeam.name).toBe('Rumania')
    expect(g.awayTeam.name).toBe('Suecia')
    expect(g.homeTeam.score).toBeUndefined()
    expect(g.awayTeam.score).toBeUndefined()
  })

  it('mapea scores válidos y finished', () => {
    const g = mapRawGame({
      ...rawSuggestion,
      statusGroup: 4,
      statusText: 'Finalizado',
      scores: [2, 1],
    })
    expect(g.status).toBe('finished')
    expect(g.homeTeam.score).toBe(2)
    expect(g.awayTeam.score).toBe(1)
  })

  it('statusGroup desconocido cae a upcoming', () => {
    const g = mapRawGame({ ...rawSuggestion, statusGroup: 99 })
    expect(g.statusGroup).toBe(2)
    expect(g.status).toBe('upcoming')
  })
})

describe('MatchTimeline — link a jugador', () => {
  it('el nombre del jugador con playerId es botón navegable', () => {
    render(
      <MemoryRouter>
        <MatchTimeline
          timeline={[
            { minute: 23, type: 'goal', teamId: 1, playerId: 150096, playerName: 'P. Charles', description: 'P. Charles', isMajor: true },
            { minute: 45, type: 'yellow_card', teamId: 2, playerName: 'Anónimo', description: 'Anónimo' },
          ]}
          homeTeamId={1}
          awayTeamId={2}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /P\. Charles/ })).toBeInTheDocument()
    // Sin playerId sigue siendo texto plano, no botón.
    expect(screen.queryByRole('button', { name: 'Anónimo' })).not.toBeInTheDocument()
    expect(screen.getByText('Anónimo')).toBeInTheDocument()
  })
})
