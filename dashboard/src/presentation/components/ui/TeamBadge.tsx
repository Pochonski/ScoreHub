import { memo, useState } from 'react'

interface TeamBadgeProps {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
}

export const TeamBadge = memo(function TeamBadge({ src, name = '', size = 'md' }: TeamBadgeProps) {
  const [failed, setFailed] = useState(false)

  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div
      className={`${sizeMap[size]} bg-bg-elevated flex shrink-0 items-center justify-center overflow-hidden rounded-full`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className="font-display text-text-muted text-lg font-bold">{initial}</span>
      )}
    </div>
  )
})
