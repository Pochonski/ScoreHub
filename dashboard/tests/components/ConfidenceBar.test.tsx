import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceBar } from '@/presentation/components/ui/ConfidenceBar'

describe('ConfidenceBar', () => {
  it('renderiza el label cuando se proporciona', () => {
    render(<ConfidenceBar percentage={50} label="Gana Local" />)
    expect(screen.getByText('Gana Local')).toBeInTheDocument()
  })

  it('renderiza el valor cuando se proporciona', () => {
    render(<ConfidenceBar percentage={75} value="75%" />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('no renderiza label/value si no se proporcionan', () => {
    const { container } = render(<ConfidenceBar percentage={50} />)
    const bar = container.querySelector('[style*="width: 50%"]')
    expect(bar).toBeInTheDocument()
  })

  it('aplica el porcentaje correcto al width', () => {
    const { container } = render(<ConfidenceBar percentage={65} />)
    const bar = container.querySelector('[style*="width:"]')
    expect(bar?.getAttribute('style')).toContain('width: 65%')
  })

  it('limita el porcentaje al 100% máximo', () => {
    const { container } = render(<ConfidenceBar percentage={150} />)
    const bar = container.querySelector('[style*="width:"]')
    expect(bar?.getAttribute('style')).toContain('width: 100%')
  })

  it('usa aria-label correcto para el emoji', () => {
    render(<ConfidenceBar percentage={80} label="Tip 1" />)
    expect(screen.getByLabelText('Confianza alta')).toBeInTheDocument()
  })
})
