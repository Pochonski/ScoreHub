import { useState, useEffect, useCallback } from 'react'
import type { TournamentStatEntry } from '@/domain/entities/BettingTip'
import { DiContainer } from '@/infrastructure/di/DiContainer'

interface TeamOfWeekData {
  formation: string
  players: Array<{ name: string; rating: number; position: string; photoUrl?: string }>
}

export function useTournamentStats() {
  const [scorers, setScorers] = useState<TournamentStatEntry[]>([])
  const [assists, setAssists] = useState<TournamentStatEntry[]>([])
  const [ratings, setRatings] = useState<TournamentStatEntry[]>([])
  const [teamOfWeek, setTeamOfWeek] = useState<TeamOfWeekData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const repo = DiContainer.getInstance().getTournamentStatsRepository()
      const [s, a, r, tow] = await Promise.all([
        repo.getTopScorers(),
        repo.getTopAssists(),
        repo.getTopRatings(),
        repo.getTeamOfWeek(),
      ])
      if (!signal?.aborted) {
        setScorers(s)
        setAssists(a)
        setRatings(r)
        setTeamOfWeek(tow)
      }
    } catch {
      if (!signal?.aborted) {
        setScorers([])
        setAssists([])
        setRatings([])
        setTeamOfWeek(null)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { scorers, assists, ratings, teamOfWeek, loading, refetch: () => fetch() }
}
