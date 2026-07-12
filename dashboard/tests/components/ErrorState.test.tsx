import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

describe('ErrorState', () => {
  it('renderiza el mensaje por defecto', () => {
    render(<ErrorState />)
    expect(screen.getByText(/Ocurrió un error/i)).toBeInTheDocument()
  })

  it('renderiza el mensaje personalizado', () => {
    render(<ErrorState message="Error personalizado" />)
    expect(screen.getByText('Error personalizado')).toBeInTheDocument()
  })

  it('renderiza el código de error', () => {
    render(<ErrorState code="ERR_500" />)
    expect(screen.getByText('ERR_500')).toBeInTheDocument()
  })

  it('renderiza el botón Reintentar cuando hay onRetry', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByText('Reintentar')).toBeInTheDocument()
  })

  it('no renderiza el botón Reintentar sin onRetry', () => {
    render(<ErrorState />)
    expect(screen.queryByText('Reintentar')).not.toBeInTheDocument()
  })

  it('llama onRetry al hacer click', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    fireEvent.click(screen.getByText('Reintentar'))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
