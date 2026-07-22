import { useState, useEffect, useCallback } from 'react'
import type { HistoryEdition } from '@/domain/entities/HistoryEdition'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getHistoryRepository()

export function useHistory(competitionId?: number | null) {
  const [history, setHistory] = useState<HistoryEdition[]>([])
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const data = await repo.getHistory(competitionId ?? undefined)
      if (!signal?.aborted) setHistory(data)
    } catch {
      if (!signal?.aborted) setHistory([])
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

  return { history, loading, refetch: () => fetch() }
}
