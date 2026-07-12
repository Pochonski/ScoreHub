import { useEffect, type RefObject } from 'react'

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean = true,
  options: { restoreFocus?: boolean; autoFocus?: boolean } = {}
): void {
  const { restoreFocus = true, autoFocus = true } = options

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('aria-hidden'))

    if (autoFocus) {
      const focusable = getFocusable()
      focusable[0]?.focus()
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const closeEvent = new CustomEvent('focus-trap-escape', { bubbles: true })
        container.dispatchEvent(closeEvent)
      }
    }

    document.addEventListener('keydown', handleTab)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('keydown', handleTab)
      document.removeEventListener('keydown', handleKey)
      if (restoreFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [isActive, containerRef, restoreFocus, autoFocus])
}