import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { BettingTrends } from '@/presentation/components/trends/BettingTrends'
import type { Trend } from '@/domain/entities/BettingTip'

const mk = (t: Partial<Trend>): Trend => ({ ...t } as Trend)

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BettingTrends', () => {
  it('dedup por apuesta quedándose con el % más alto, ordenado desc', () => {
    renderWithClient(<BettingTrends trends={[
      mk({ betCTA: 'Over 2.5', text: 'a', percentage: 0.7, lineTypeId: 3 }),
      mk({ betCTA: 'Over 2.5', text: 'b', percentage: 0.9, lineTypeId: 3 }), // dup, gana 0.9
      mk({ betCTA: 'BTTS', text: 'c', percentage: 0.6, lineTypeId: 12 }),
    ]} />)
    expect(screen.getByText('Over 2.5')).toBeInTheDocument()
    expect(screen.getByText('BTTS')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument() // ganó el dup más alto
    expect(screen.queryByText('70%')).not.toBeInTheDocument()
  })

  it('lista vacía → no renderiza nada', () => {
    const { container } = renderWithClient(<BettingTrends trends={[]} />)
    expect(container.textContent).toBe('')
  })

  it('respeta el limit', () => {
    renderWithClient(<BettingTrends limit={2} trends={[
      mk({ betCTA: 'A', text: 'a', percentage: 0.9, lineTypeId: 1 }),
      mk({ betCTA: 'B', text: 'b', percentage: 0.8, lineTypeId: 1 }),
      mk({ betCTA: 'C', text: 'c', percentage: 0.7, lineTypeId: 1 }),
    ]} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByText('C')).not.toBeInTheDocument()
  })

  it('cada fila es un botón con aria-label de detalle', () => {
    renderWithClient(<BettingTrends trends={[mk({ betCTA: 'Over 2.5', text: 'a', percentage: 0.7, lineTypeId: 3 })]} />)
    expect(screen.getByRole('button', { name: 'Ver detalle: Over 2.5' })).toBeInTheDocument()
  })
})
