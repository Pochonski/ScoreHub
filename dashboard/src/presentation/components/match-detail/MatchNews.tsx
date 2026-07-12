import { memo, useState } from 'react'
import type { News } from '@/domain/entities/News'
import { formatDate } from '@/presentation/utils/dates'

interface MatchNewsProps {
  news: News[]
}

const NewsThumb = memo(function NewsThumb({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)
  if (error) return null
  return (
    <img
      src={src}
      alt={alt}
      className="bg-bg-elevated h-16 w-16 shrink-0 rounded-lg object-cover"
      onError={() => setError(true)}
      loading="lazy"
    />
  )
})

export const MatchNews = memo(function MatchNews({ news }: MatchNewsProps) {
  if (news.length === 0) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">Noticias</h3>
      </div>
      <div className="space-y-3 p-5">
        {news.slice(0, 5).map((article, i) => (
          <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" className="group block">
            <div className="flex items-start gap-3">
              {article.image && <NewsThumb src={article.image} alt={article.title} />}
              <div className="min-w-0">
                <p className="font-body text-text-primary group-hover:text-accent-blue line-clamp-2 text-sm font-medium transition-colors">
                  {article.title}
                </p>
                <p className="font-body text-text-dim mt-1 text-[10px]">{formatDate(article.publishDate)}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
})
