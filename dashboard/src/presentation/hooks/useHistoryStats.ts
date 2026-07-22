import { useState, useEffect, useCallback } from 'react'
import type { HistoryStats } from '@/domain/entities/HistoryStats'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getHistoryRepository()

export function useHistoryStats(competitionId?: number | null) {
  const [stats, setStats] = useState<HistoryStats | null>(null)
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const data = await repo.getHistoryStats(competitionId ?? undefined)
      if (!signal?.aborted) setStats(data)
    } catch {
      if (!signal?.aborted) setStats(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [competitionId])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { stats, loading, refetch: () => fetch() }
}
