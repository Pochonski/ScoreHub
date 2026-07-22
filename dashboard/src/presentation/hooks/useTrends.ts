import { useState, useEffect, useCallback } from 'react'
import type { Trend } from '@/domain/entities/BettingTip'
import { DiContainer } from '@/infrastructure/di/DiContainer'

export function useTrends(competitionId?: number | null) {
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const repo = DiContainer.getInstance().getBettingTipRepository()
      const data = await repo.getCompetitionTrends(competitionId ?? undefined)
      if (!signal?.aborted) setTrends(data)
    } catch {
      if (!signal?.aborted) setTrends([])
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

  return { trends, loading, refetch: () => fetch() }
}
