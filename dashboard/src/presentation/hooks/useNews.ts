import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { News } from '@/domain/entities/News'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

const PAGE_SIZE = 6

/**
 * TanStack Query version. External shape preserved:
 * returns { news, loading, error, refetch, loadMore, hasMore }.
 *
 * Pagination uses page-index state instead of useRef.current,
 * keeping refs outside render. Each page is a separate cached query
 * so TanStack Query dedupes concurrent loads.
 */
export function useNews(initialLimit = PAGE_SIZE, competitionId?: number | null) {
  const [extraPages, setExtraPages] = useState(0)
  const initialPages = Math.max(1, Math.ceil(initialLimit / PAGE_SIZE))
  const totalPages = initialPages + extraPages
  const limit = totalPages * PAGE_SIZE

  const qKey = ['news', 'competition', competitionId ?? null, totalPages] as const
  const { data, isLoading, error, refetch } = useQuery<News[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await apiClient.get<News[]>(ENDPOINTS.news, {
        params: { limit: String(limit), scope: 'competition', competitionId: String(competitionId) },
      })
      return r ?? []
    },
    staleTime: 60 * 1000,
  })

  const loadMore = useCallback(async () => {
    if (!data || data.length < limit) return
    setExtraPages(p => p + 1)
  }, [data, limit])

  const errMsg = error instanceof Error ? error.message : null
  return {
    news: data ?? [],
    loading: isLoading,
    error: errMsg,
    refetch: () => refetch(),
    loadMore,
    hasMore: data ? data.length >= limit : true,
  }
}
