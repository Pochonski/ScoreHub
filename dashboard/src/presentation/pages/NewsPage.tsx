import { useNews } from '@/presentation/hooks/useNews'
import { NewsFeed } from '@/presentation/components/news/NewsFeed'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

export function NewsPage() {
  const { news, loading, loadMore, hasMore, error } = useNews(12)

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-text-primary text-2xl font-bold sm:text-3xl">Noticias</h1>
        <p className="font-body text-text-muted mt-1 text-sm">
          Últimas noticias del Mundial y de los equipos
        </p>
      </div>

      {error ? (
        <ErrorState message={error} fullPage />
      ) : (
        <NewsFeed
          news={news}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={loading && news.length === 0}
        />
      )}
    </div>
  )
}
