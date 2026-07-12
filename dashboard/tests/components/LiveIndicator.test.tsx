import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveIndicator } from '@/presentation/components/ui/LiveIndicator'

describe('LiveIndicator', () => {
  it('renderiza "EN VIVO" para status live', () => {
    render(<LiveIndicator status="live" minute={45} />)
    expect(screen.getByText(/EN VIVO/i)).toBeInTheDocument()
  })

  it('no renderiza nada para status upcoming', () => {
    const { container } = render(<LiveIndicator status="upcoming" />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza "Final" para status finished', () => {
    render(<LiveIndicator status="finished" />)
    expect(screen.getByText('Final')).toBeInTheDocument()
  })

  it('renderiza el minuto cuando está en vivo', () => {
    render(<LiveIndicator status="live" minute={67} />)
    expect(screen.getByText(/67/)).toBeInTheDocument()
  })
})
