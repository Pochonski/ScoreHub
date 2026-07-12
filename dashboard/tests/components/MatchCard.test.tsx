import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MatchCard } from '@/presentation/components/matches/MatchCard'
import { createMockGame, createLiveGame, createFinishedGame } from '../factories/game'

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('MatchCard', () => {
  it('renderiza VS para partidos upcoming sin marcador', () => {
    const game = createMockGame({
      status: 'upcoming',
      homeTeam: { id: 1, name: 'Brasil' },
      awayTeam: { id: 2, name: 'Argentina' },
    })
    renderWithRouter(<MatchCard game={game} />)
    expect(screen.getByText('VS')).toBeInTheDocument()
  })

  it('renderiza el marcador para partidos live', () => {
    const game = createLiveGame({
      homeTeam: { id: 1, name: 'Brasil', score: 2 },
      awayTeam: { id: 2, name: 'Argentina', score: 1 },
    })
    renderWithRouter(<MatchCard game={game} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renderiza el marcador para partidos finished', () => {
    const game = createFinishedGame({
      homeTeam: { id: 1, name: 'Brasil', score: 3 },
      awayTeam: { id: 2, name: 'Argentina', score: 0 },
    })
    renderWithRouter(<MatchCard game={game} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renderiza nombres de equipos', () => {
    const game = createMockGame({
      homeTeam: { id: 1, name: 'Brasil' },
      awayTeam: { id: 2, name: 'Argentina' },
    })
    renderWithRouter(<MatchCard game={game} />)
    expect(screen.getByText('Brasil')).toBeInTheDocument()
    expect(screen.getByText('Argentina')).toBeInTheDocument()
  })

  it('llama onSelect cuando se hace click', () => {
    const onSelect = vi.fn()
    const game = createMockGame()
    renderWithRouter(<MatchCard game={game} onSelect={onSelect} />)
    const card = screen.getByRole('button')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledWith(game)
  })

  it('llama onSelect cuando se presiona Enter', () => {
    const onSelect = vi.fn()
    const game = createMockGame()
    renderWithRouter(<MatchCard game={game} onSelect={onSelect} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(game)
  })

  it('aplica el ring de live cuando el partido está en vivo', () => {
    const game = createLiveGame()
    const { container } = renderWithRouter(<MatchCard game={game} />)
    const card = container.firstChild
    expect(card?.className).toContain('ring-accent-live')
  })
})
