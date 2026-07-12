import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageWithFallback } from '@/presentation/components/ui/ImageWithFallback'

describe('ImageWithFallback', () => {
  it('renderiza la imagen cuando src es válido', () => {
    const { container } = render(<ImageWithFallback src="/test.png" alt="test" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/test.png')
    expect(img).toHaveAttribute('alt', 'test')
  })

  it('renderiza fallback inicial cuando no hay src', () => {
    render(<ImageWithFallback fallbackInitial="Brasil" alt="brazil flag" />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renderiza fallback cuando hay error de carga', () => {
    const { container } = render(<ImageWithFallback src="/missing.png" alt="missing" fallbackInitial="X" />)
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    fireEvent.error(img!)
    expect(screen.getByText('X')).toBeInTheDocument()
  })

  it('acepta fallback custom', () => {
    render(
      <ImageWithFallback
        src="/missing.png"
        alt="missing"
        fallback={<span data-testid="custom-fallback">Custom</span>}
      />
    )
    const img = document.querySelector('img')!
    fireEvent.error(img)
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
  })

  it('marca el fallback como aria-hidden', () => {
    const { container } = render(<ImageWithFallback fallbackInitial="?" alt="?" />)
    const fallback = container.querySelector('[aria-hidden="true"]')
    expect(fallback).toBeInTheDocument()
  })
})