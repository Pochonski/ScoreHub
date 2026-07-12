import { useState, useCallback, useEffect } from 'react'
import type { News } from '@/domain/entities/News'
import { NewsCard } from './NewsCard'

interface NewsFeedProps {
  news: News[]
  onLoadMore?: () => Promise<void>
  hasMore?: boolean
  loading?: boolean
}

export function NewsFeed({ news, onLoadMore, hasMore = false, loading = false }: NewsFeedProps) {
  const [loadingMore, setLoadingMore] = useState(false)

  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || loadingMore) return
    try {
      setLoadingMore(true)
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }, [onLoadMore, loadingMore])

  if (news.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-muted font-body text-sm">No hay noticias disponibles</p>
      </div>
    )
  }

  return (
    <section aria-label="Últimas noticias">
      <h2 className="font-display text-text-primary mb-3 text-xl font-semibold">Noticias</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
      {(hasMore || loading) && (
        <div className="mt-6 flex justify-center">
          {loadingMore || loading ? (
            <span className="font-body text-text-muted animate-pulse text-sm">Cargando...</span>
          ) : hasMore ? (
            <button
              onClick={handleLoadMore}
              className="bg-bg-card text-text-primary font-body hover:bg-bg-elevated border-border-card focus-visible rounded-lg border px-6 py-2 text-sm font-medium transition-colors"
            >
              Cargar más noticias
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
