import { memo, useState, type ImgHTMLAttributes, type ReactNode } from 'react'

interface ImageWithFallbackProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError'> {
  src?: string
  alt: string
  fallback?: ReactNode
  fallbackInitial?: string
}

export const ImageWithFallback = memo(function ImageWithFallback({
  src,
  alt,
  fallback,
  fallbackInitial,
  className,
  ...imgProps
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false)
  const showFallback = !src || errored

  if (showFallback) {
    if (fallback) return <>{fallback}</>
    return (
      <div className={`bg-bg-elevated flex items-center justify-center ${className ?? ''}`} aria-hidden="true">
        <span className="font-display text-text-muted text-sm font-bold">
          {fallbackInitial?.charAt(0).toUpperCase() ?? '?'}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setErrored(true)}
      {...imgProps}
    />
  )
})