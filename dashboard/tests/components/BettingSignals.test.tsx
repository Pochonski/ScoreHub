import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  sampleLevel,
  formatVotes,
  extractSampleSize,
  MIN_VOTES,
  HIDE_BELOW_VOTES,
} from '@/presentation/components/trends/bettingSignals'
import { MatchPredictions } from '@/presentation/components/match-detail/MatchPredictions'
import { MatchTips } from '@/presentation/components/match-detail/MatchTips'
import type { Prediction } from '@/domain/entities/Prediction'
import type { BettingTip } from '@/domain/entities/BettingTip'

describe('bettingSignals — umbrales', () => {
  it('clasifica niveles de muestra', () => {
    expect(sampleLevel(HIDE_BELOW_VOTES - 1)).toBe('hide')
    expect(sampleLevel(HIDE_BELOW_VOTES)).toBe('small')
    expect(sampleLevel(MIN_VOTES - 1)).toBe('small')
    expect(sampleLevel(MIN_VOTES)).toBe('solid')
    expect(sampleLevel(10107)).toBe('solid')
    expect(sampleLevel(undefined)).toBe('hide')
  })

  it('formatea votos en es-ES', () => {
    expect(formatVotes(10107)).toBe('10.107 votos')
  })

  it('extrae N/M del texto del trend', () => {
    expect(extractSampleSize('Moldavia no ganó - 17/18 Últimos partidos')).toBe('17/18')
    expect(extractSampleSize('Menos de 2.5 goles - 4/5 Últimos partidos')).toBe('4/5')
    expect(extractSampleSize('Sin patrón')).toBeNull()
    expect(extractSampleSize(undefined)).toBeNull()
  })
})

const bigPoll: Prediction = {
  title: '¿Quién va a ganar?',
  totalVotes: 10107,
  options: [{ text: 'A', percentage: 60, voteCount: 6000 }],
}
const smallPoll: Prediction = {
  title: 'Goles (2.5)',
  totalVotes: 50,
  options: [{ text: 'Menos de', percentage: 68, voteCount: 34 }],
}
const tinyPoll: Prediction = { title: 'Ruido', totalVotes: 5, options: [{ text: 'X', percentage: 100, voteCount: 5 }] }

describe('MatchPredictions — jerarquía por muestra', () => {
  it('muestra votos, colapsa muestra pequeña y oculta ruido', () => {
    render(
      <MemoryRouter>
        <MatchPredictions predictions={[smallPoll, bigPoll, tinyPoll]} />
      </MemoryRouter>
    )
    expect(screen.getByText('Pronóstico de la comunidad')).toBeInTheDocument()
    expect(screen.getByText('10.107 votos')).toBeInTheDocument()
    // Muestra pequeña colapsada con etiqueta.
    expect(screen.getByText(/muestra pequeña/)).toBeInTheDocument()
    // Ruido oculto.
    expect(screen.queryByText('Ruido')).not.toBeInTheDocument()
    // Orden: más votos primero.
    const titles = screen.getAllByText(/¿Quién va a ganar\?|Goles \(2\.5\)/)
    expect(titles[0].textContent).toMatch(/¿Quién va a ganar\?/)
  })

  it('retorna null si todo es ruido', () => {
    const { container } = render(
      <MemoryRouter>
        <MatchPredictions predictions={[tinyPoll]} />
      </MemoryRouter>
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('MatchTips — etiqueta honesta + muestra', () => {
  it('muestra título de historial y N de muestra', () => {
    const tips = {
      topTrends: [{ text: 'Moldavia no ganó - 17/18 Últimos partidos', percentage: 0.94, betCTA: 'X', lineTypeId: 14 }],
    } as BettingTip
    render(
      <MemoryRouter>
        <MatchTips tips={tips} />
      </MemoryRouter>
    )
    expect(screen.getByText('Tendencias del historial')).toBeInTheDocument()
    expect(screen.getByText('Muestra: 17/18 partidos')).toBeInTheDocument()
    expect(screen.getByText('94%')).toBeInTheDocument()
  })
})
