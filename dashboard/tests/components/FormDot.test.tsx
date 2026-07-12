import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormDot } from '@/presentation/components/ui/FormDot'

describe('FormDot', () => {
  it('renderiza Victoria para resultado W', () => {
    render(<FormDot result="W" />)
    expect(screen.getByLabelText('Victoria')).toBeInTheDocument()
  })

  it('renderiza Empate para resultado D', () => {
    render(<FormDot result="D" />)
    expect(screen.getByLabelText('Empate')).toBeInTheDocument()
  })

  it('renderiza Derrota para resultado L', () => {
    render(<FormDot result="L" />)
    expect(screen.getByLabelText('Derrota')).toBeInTheDocument()
  })

  it('aplica tamaño sm por defecto', () => {
    const { container } = render(<FormDot result="W" />)
    const dot = container.querySelector('span')
    expect(dot?.className).toContain('w-1.5')
    expect(dot?.className).toContain('h-1.5')
  })

  it('acepta tamaño md', () => {
    const { container } = render(<FormDot result="W" size="md" />)
    const dot = container.querySelector('span')
    expect(dot?.className).toContain('w-2.5')
    expect(dot?.className).toContain('h-2.5')
  })
})
