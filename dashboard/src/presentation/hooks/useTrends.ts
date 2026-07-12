import { useState, useEffect, useCallback } from 'react'
import type { Trend } from '@/domain/entities/BettingTip'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

export function useTrends() {
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const data = await apiClient.get<Trend[]>(ENDPOINTS.trends, { signal })
      if (!signal?.aborted) setTrends(data)
    } catch {
      if (!signal?.aborted) setTrends([])
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { trends, loading, refetch: () => fetch() }
}
