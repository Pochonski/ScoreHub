import { useState } from 'react'
import { competitionLogoUrl } from '@/shared/images'

/**
 * Logo de una competición con fallback a monograma (iniciales) cuando el CDN no
 * tiene imagen. Componente compartido por el selector del navbar y el rail de
 * "Ligas populares" para que se vean idénticos.
 */
export function CompetitionLogo({
  id,
  name,
  className = 'h-7 w-7 rounded-md',
}: {
  id: number
  name: string
  /** Clases de tamaño/redondeo (h/w/rounded). Se aplican a img y monograma. */
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase() || '?'

  if (failed) {
    return (
      <span
        className={`bg-bg-elevated text-accent-gold font-display flex shrink-0 items-center justify-center text-[11px] font-bold ${className}`}
      >
        {initials}
      </span>
    )
  }
  return (
    <img
      src={competitionLogoUrl(id)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
    />
  )
}
