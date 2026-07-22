import { useState, useEffect, useCallback } from 'react'
import type { Team } from '@/domain/entities/Team'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getTeamRepository()

export function useTeams(nationalOnly?: boolean, competitionId?: number | null) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        const data = await repo.getTeams(nationalOnly, competitionId ?? undefined)
        if (!signal?.aborted) setTeams(data)
      } catch {
        if (!signal?.aborted) setTeams([])
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [nationalOnly, competitionId]
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { teams, loading, refetch: () => fetch() }
}

export function useTeam(id: number | null, competitionId?: number | null) {
  const [team, setTeam] = useState<Team | null>(null)
  const [matches, setMatches] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      if (id == null) return
      try {
        setLoading(true)
        const [t, m] = await Promise.all([
          repo.getTeamById(id),
          repo.getTeamMatches(id, competitionId ?? undefined),
        ])
        if (!signal?.aborted) {
          setTeam(t)
          setMatches(m)
        }
      } catch {
        if (!signal?.aborted) {
          setTeam(null)
          setMatches([])
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [id, competitionId]
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { team, matches, loading, refetch: () => fetch() }
}
