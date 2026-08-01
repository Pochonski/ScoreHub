import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { News } from '@/domain/entities/News'
import { useNews } from '@/presentation/hooks/useNews'
import { CollapsibleSection } from './CollapsibleSection'

interface NewsRailProps {
  competitionId?: number
}

function timeAgo(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime()
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

const NewsThumb = memo(function NewsThumb({ src }: { src?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className="bg-bg-elevated flex h-12 w-16 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
        <span className="text-text-dim text-base">📰</span>
      </div>
    )
  }
  return (
    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg">
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setError(true)} />
    </div>
  )
})

function NewsRow({ item }: { item: News }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:bg-bg-elevated focus-visible group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors"
    >
      <NewsThumb src={item.image} />
      <div className="min-w-0 flex-1">
        <h3 className="font-body text-text-primary group-hover:text-accent-blue line-clamp-2 text-[13px] leading-snug font-medium transition-colors">
          {item.title}
        </h3>
        <p className="text-text-dim mt-0.5 font-mono text-[10px]">{timeAgo(item.publishDate)}</p>
      </div>
    </a>
  )
}

export function NewsRail({ competitionId }: NewsRailProps) {
  const { news, loading } = useNews(4, competitionId ?? null)

  if (!loading && news.length === 0) return null

  return (
    <CollapsibleSection
      icon="📰"
      title="Noticias"
      storageKey="rail:news"
      action={
        <Link
          to="/noticias"
          className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded text-[11px] transition-colors"
        >
          Ver más →
        </Link>
      }
    >
      <div className="px-1.5 py-1.5">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          news.slice(0, 4).map((item) => <NewsRow key={item.id} item={item} />)
        )}
      </div>
    </CollapsibleSection>
  )
}
