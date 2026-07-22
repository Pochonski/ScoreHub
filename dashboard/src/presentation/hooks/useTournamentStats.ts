import { useState, useEffect, useCallback } from 'react'
import type { TournamentStatEntry } from '@/domain/entities/BettingTip'
import { DiContainer } from '@/infrastructure/di/DiContainer'

interface TeamOfWeekData {
  formation: string
  players: Array<{ name: string; rating: number; position: string; photoUrl?: string }>
}

export function useTournamentStats(competitionId?: number | null) {
  const [scorers, setScorers] = useState<TournamentStatEntry[]>([])
  const [assists, setAssists] = useState<TournamentStatEntry[]>([])
  const [ratings, setRatings] = useState<TournamentStatEntry[]>([])
  const [teamOfWeek, setTeamOfWeek] = useState<TeamOfWeekData | null>(null)
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const repo = DiContainer.getInstance().getTournamentStatsRepository()
      const cid = competitionId ?? undefined
      const [s, a, r, tow] = await Promise.all([
        repo.getTopScorers(cid),
        repo.getTopAssists(cid),
        repo.getTopRatings(cid),
        repo.getTeamOfWeek(cid),
      ])
      if (!signal?.aborted) {
        setScorers(s)
        setAssists(a)
        setRatings(r)
        setTeamOfWeek(tow as TeamOfWeekData | null)
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
  }, [competitionId])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { scorers, assists, ratings, teamOfWeek, loading, refetch: () => fetch() }
}
