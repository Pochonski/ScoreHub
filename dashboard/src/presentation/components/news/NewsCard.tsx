import { memo, useState } from 'react'
import type { News } from '@/domain/entities/News'

interface NewsCardProps {
  item: News
}

function timeAgo(iso: string): string {
  try {
    const now = Date.now()
    const then = new Date(iso).getTime()
    const diffMs = now - then
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `hace ${days}d`
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

const NewsImage = memo(function NewsImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div className="bg-bg-elevated flex aspect-[16/9] items-center justify-center" aria-hidden="true">
        <span className="font-display text-text-dim text-3xl">📰</span>
      </div>
    )
  }
  return (
    <div className="aspect-[16/9] overflow-hidden">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  )
})

export const NewsCard = memo(function NewsCard({ item }: NewsCardProps) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-bg-card border-border-card hover:border-border-hover group focus-visible block overflow-hidden rounded-xl border transition-all duration-200"
    >
      {item.image ? (
        <NewsImage src={item.image} alt={item.title} />
      ) : (
        <div className="bg-bg-elevated flex aspect-[16/9] items-center justify-center">
          <span role="img" aria-label="Noticia" className="font-display text-text-dim text-3xl">
            📰
          </span>
        </div>
      )}
      <div className="p-3">
        <h3 className="font-body text-text-primary line-clamp-2 text-sm leading-snug font-medium">
          {item.title}
        </h3>
        <p className="text-text-dim mt-1.5 font-mono text-[11px]">{timeAgo(item.publishDate)}</p>
      </div>
    </a>
  )
})
