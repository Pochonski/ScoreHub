import { useNews } from '@/presentation/hooks/useNews'
import { NewsFeed } from '@/presentation/components/news/NewsFeed'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

/**
 * NewsTab — noticias de una competición concreta. A diferencia de la antigua
 * página global `/noticias`, siempre pasa `competitionId` a `useNews`, de modo
 * que el request lleva `scope=competition&competitionId=<id>` en vez del
 * `competitionId=undefined` que devolvía 400.
 */
export function NewsTab({ competitionId }: { competitionId: number }) {
  const { news, loading, loadMore, hasMore, error } = useNews(12, competitionId)

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <NewsFeed
      news={news}
      onLoadMore={loadMore}
      hasMore={hasMore}
      loading={loading && news.length === 0}
    />
  )
}
