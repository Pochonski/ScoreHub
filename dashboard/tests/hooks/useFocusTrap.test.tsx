import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from '@/presentation/hooks/useFocusTrap'

function TestTrapComponent({ isActive = true }: { isActive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, isActive)

  return (
    <div ref={containerRef}>
      <button>First</button>
      <button>Middle</button>
      <button>Last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('autofocus en el primer focusable', () => {
    render(<TestTrapComponent />)
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('Tab al final vuelve al primero', () => {
    render(<TestTrapComponent />)
    const last = screen.getByText('Last')
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('Shift+Tab al inicio va al último', () => {
    render(<TestTrapComponent />)
    const first = screen.getByText('First')
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Last')).toHaveFocus()
  })

  it('Escape emite evento focus-trap-escape', () => {
    const handler = vi.fn()
    render(
      <div>
        <TestTrapComponent />
        <button onClick={handler}>Listener</button>
      </div>
    )
    const container = screen.getByText('First').closest('div')!
    container.addEventListener('focus-trap-escape', handler)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handler).toHaveBeenCalledOnce()
  })
})