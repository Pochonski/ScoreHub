import { useState, useEffect, useCallback } from 'react'
import type { BettingTip } from '@/domain/entities/BettingTip'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

export function useMatchTips(gameId: number | null) {
  const [tips, setTips] = useState<BettingTip | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      if (gameId == null) {
        if (!signal?.aborted) setTips(null)
        return
      }
      try {
        setLoading(true)
        const data = await apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(gameId), { signal })
        if (!signal?.aborted) setTips(data)
      } catch {
        if (!signal?.aborted) setTips(null)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [gameId]
  )

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { tips, loading, refetch: () => fetch() }
}
