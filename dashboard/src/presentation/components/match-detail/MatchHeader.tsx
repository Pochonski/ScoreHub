import { useNavigate } from 'react-router-dom'
import { memo } from 'react'

interface MatchHeaderProps {
  onBack?: () => void
}

export const MatchHeader = memo(function MatchHeader({ onBack }: MatchHeaderProps) {
  const navigate = useNavigate()
  const handleBack = onBack ?? (() => navigate(-1))

  return (
    <button
      onClick={handleBack}
      className="font-body text-text-muted hover:text-text-primary focus-visible flex items-center gap-1.5 text-xs transition-colors"
      aria-label="Volver a la página anterior"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M9 3L5 7l4 4" />
      </svg>
      Volver
    </button>
  )
})
