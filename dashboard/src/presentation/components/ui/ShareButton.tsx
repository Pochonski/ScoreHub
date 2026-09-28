import { useState, useCallback } from 'react'

/**
 * ShareButton — compartir por Web Share API con fallback a portapapeles.
 * Muestra confirmación breve ("¡Enlace copiado!") al copiar.
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, text: text ?? title, url })
        return
      } catch (e) {
        // AbortError = usuario canceló: no hacer nada.
        if (e instanceof Error && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* portapapeles no disponible */
    }
  }, [title, text])

  return (
    <button
      type="button"
      onClick={handleShare}
      className="font-body bg-bg-card border-border-card text-text-muted hover:text-accent-gold hover:border-border-hover focus-visible inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200"
      aria-label="Compartir"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? '¡Enlace copiado!' : 'Compartir'}
    </button>
  )
}
