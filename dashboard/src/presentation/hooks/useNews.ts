import { useState, useEffect, useCallback, useRef } from 'react'
import type { News } from '@/domain/entities/News'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const PAGE_SIZE = 6

export function useNews(initialLimit = PAGE_SIZE) {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const limitRef = useRef(initialLimit)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)
      const repo = DiContainer.getInstance().getNewsRepository()
      const data = await repo.getNews(limitRef.current)
      if (!signal?.aborted) {
        setNews(data)
        if (data.length < limitRef.current) setHasMore(false)
      }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Error al cargar noticias')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    limitRef.current += PAGE_SIZE
    await fetch()
  }, [loading, hasMore, fetch])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { news, loading, error, refetch: () => fetch(), loadMore, hasMore }
}
