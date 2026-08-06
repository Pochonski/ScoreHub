import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BetTrendRow } from '@/presentation/components/trends/BetTrendRow'
import type { Trend } from '@/domain/entities/BettingTip'

const mk = (t: Partial<Trend>): Trend => ({ ...t } as Trend)

describe('BetTrendRow', () => {
  it('muestra betCTA como titular, text como evidencia y el porcentaje', () => {
    render(<BetTrendRow trend={mk({ betCTA: 'Over 2.5', text: '8 de 10 partidos', percentage: 0.8, lineTypeId: 3 })} />)
    expect(screen.getByText('Over 2.5')).toBeInTheDocument()
    expect(screen.getByText('8 de 10 partidos')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Over/Under')).toBeInTheDocument() // categoría por lineTypeId 3
  })

  it('sin betCTA: usa text como titular y no muestra evidencia', () => {
    render(<BetTrendRow trend={mk({ text: 'Racha ganadora', percentage: 0.5, lineTypeId: 1 })} />)
    expect(screen.getByText('Racha ganadora')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Ganador')).toBeInTheDocument() // lineTypeId 1
  })

  it('categoría desde lineTypeLabel cuando el lineTypeId no está mapeado', () => {
    render(<BetTrendRow trend={mk({ betCTA: 'X', text: 'y', percentage: 0.6, lineTypeId: 99, lineTypeLabel: 'Córners' })} />)
    expect(screen.getByText('Córners')).toBeInTheDocument()
  })

  it('ignora el placeholder "Tipo N" del backend', () => {
    render(<BetTrendRow trend={mk({ betCTA: 'X', text: 'y', percentage: 0.6, lineTypeId: 99, lineTypeLabel: 'Tipo 99' })} />)
    expect(screen.queryByText('Tipo 99')).not.toBeInTheDocument()
  })

  it('redondea el porcentaje', () => {
    render(<BetTrendRow trend={mk({ text: 't', percentage: 0.826, lineTypeId: 1 })} />)
    expect(screen.getByText('83%')).toBeInTheDocument()
  })

  it('percentage ausente → 0%', () => {
    render(<BetTrendRow trend={mk({ text: 't', lineTypeId: 1 })} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
