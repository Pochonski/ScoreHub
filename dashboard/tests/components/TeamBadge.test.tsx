import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'

describe('TeamBadge', () => {
  it('renderiza la inicial cuando no hay src', () => {
    render(<TeamBadge name="Brasil" />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renderiza la inicial sin nombre', () => {
    render(<TeamBadge />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renderiza la imagen cuando hay src', () => {
    const { container } = render(<TeamBadge src="/brazil.png" name="Brasil" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/brazil.png')
  })

  it('aplica el tamaño sm correctamente', () => {
    const { container } = render(<TeamBadge name="Brasil" size="sm" />)
    const wrapper = container.firstChild
    expect(wrapper?.className).toContain('w-8')
    expect(wrapper?.className).toContain('h-8')
  })

  it('aplica el tamaño md por defecto', () => {
    const { container } = render(<TeamBadge name="Brasil" />)
    const wrapper = container.firstChild
    expect(wrapper?.className).toContain('w-12')
    expect(wrapper?.className).toContain('h-12')
  })

  it('aplica el tamaño lg correctamente', () => {
    const { container } = render(<TeamBadge name="Brasil" size="lg" />)
    const wrapper = container.firstChild
    expect(wrapper?.className).toContain('w-20')
    expect(wrapper?.className).toContain('h-20')
  })
})
