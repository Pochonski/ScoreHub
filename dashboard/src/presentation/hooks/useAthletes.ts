import { useState, useCallback, useEffect } from 'react'
import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getAthleteRepository()

export function useAthleteProfile(id: number | null) {
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [career, setCareer] = useState<AthleteCareerSeason[]>([])
  const [trophies, setTrophies] = useState<AthleteTrophyCategory[]>([])
  const [transfers, setTransfers] = useState<AthleteTransfer[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      if (id == null) return
      try {
        setLoading(true)
        const [a, c, t, tr] = await Promise.all([
          repo.getAthleteById(id),
          repo.getAthleteCareer(id),
          repo.getAthleteTrophies(id),
          repo.getAthleteTransfers(id),
        ])
        if (!signal?.aborted) {
          setAthlete(a)
          setCareer(c)
          setTrophies(t)
          setTransfers(tr)
        }
      } catch {
        if (!signal?.aborted) {
          setAthlete(null)
          setCareer([])
          setTrophies([])
          setTransfers([])
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

  return { athlete, career, trophies, transfers, loading, refetch: () => fetch() }
}
