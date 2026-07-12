import { useState, useEffect, useCallback } from 'react'
import type { Team } from '@/domain/entities/Team'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getTeamRepository()

export function useTeams(nationalOnly?: boolean) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        const data = await repo.getTeams(nationalOnly)
        if (!signal?.aborted) setTeams(data)
      } catch {
        if (!signal?.aborted) setTeams([])
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [nationalOnly]
  )

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { teams, loading, refetch: () => fetch() }
}

export function useTeam(id: number | null) {
  const [team, setTeam] = useState<Team | null>(null)
  const [matches, setMatches] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      if (id == null) return
      try {
        setLoading(true)
        const [t, m] = await Promise.all([repo.getTeamById(id), repo.getTeamMatches(id)])
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
    [id]
  )

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { team, matches, loading, refetch: () => fetch() }
}
