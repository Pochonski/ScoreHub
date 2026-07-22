import { useState, useEffect, useCallback } from 'react'
import type { TournamentInfo } from '@/domain/entities/TournamentInfo'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getTournamentInfoRepository()

export function useTournamentInfo(competitionId?: number | null) {
  const [info, setInfo] = useState<TournamentInfo | null>(null)
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        const data = await repo.getTournamentInfo(competitionId ?? undefined)
        if (!signal?.aborted) setInfo(data)
      } catch {
        if (!signal?.aborted) setInfo(null)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [competitionId]
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { info, loading, refetch: () => fetch() }
}
