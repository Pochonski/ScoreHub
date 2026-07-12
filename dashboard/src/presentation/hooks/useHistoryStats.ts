import { useState, useEffect, useCallback } from 'react'
import type { HistoryStats } from '@/domain/entities/HistoryStats'
import { ApiHistoryRepository } from '@/data/repositories/ApiHistoryRepository'

const repo = new ApiHistoryRepository()

export function useHistoryStats() {
  const [stats, setStats] = useState<HistoryStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const data = await repo.getHistoryStats()
      if (!signal?.aborted) setStats(data)
    } catch {
      if (!signal?.aborted) setStats(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { stats, loading, refetch: () => fetch() }
}
