import { useState, useCallback, useEffect } from 'react'
import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'
import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'
import { DiContainer } from '@/infrastructure/di/DiContainer'

const repo = DiContainer.getInstance().getAthleteRepository()

function isValidAthleteId(id: number | null | undefined): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

type ProfileError =
  | { kind: 'not_found' }
  | { kind: 'rate_limited' }
  | { kind: 'server_error' }
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'invalid_id' }
  | { kind: 'unknown'; message: string }

function classifyError(err: unknown): ProfileError {
  if (!err) return { kind: 'unknown', message: '' }
  if (err instanceof AppError) {
    if (err.code === ErrorCode.NOT_FOUND) return { kind: 'not_found' }
    if (err.status === 429) return { kind: 'rate_limited' }
    if (err.code === ErrorCode.SERVER_ERROR) return { kind: 'server_error' }
    if (err.code === ErrorCode.NETWORK_ERROR) return { kind: 'network' }
    if (err.code === ErrorCode.TIMEOUT) return { kind: 'timeout' }
    return { kind: 'unknown', message: err.message }
  }
  return { kind: 'unknown', message: err instanceof Error ? err.message : String(err) }
}

export function useAthleteProfile(id: number | null) {
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [career, setCareer] = useState<AthleteCareerSeason[]>([])
  const [trophies, setTrophies] = useState<AthleteTrophyCategory[]>([])
  const [transfers, setTransfers] = useState<AthleteTransfer[]>([])
  const [loading, setLoading] = useState(isValidAthleteId(id))
  const [error, setError] = useState<ProfileError | null>(null)

  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      if (id == null) return
      if (!isValidAthleteId(id)) {
        setAthlete(null)
        setCareer([])
        setTrophies([])
        setTransfers([])
        setError({ kind: 'invalid_id' })
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const a = await repo.getAthleteById(id, { signal })
        if (signal?.aborted) return
        if (!a) {
          setAthlete(null)
          setCareer([])
          setTrophies([])
          setTransfers([])
          setError({ kind: 'not_found' })
          return
        }
        setAthlete(a)

        // Supplements: any failure here is non-fatal — the core profile
        // already loaded and we should keep showing it. Track partial errors
        // for diagnostics but don't surface them to the user.
        const results = await Promise.allSettled([
          repo.getAthleteCareer(id, { signal }),
          repo.getAthleteTrophies(id, { signal }),
          repo.getAthleteTransfers(id, { signal }),
        ])
        if (signal?.aborted) return
        const [careerRes, trophiesRes, transfersRes] = results
        setCareer(careerRes.status === 'fulfilled' ? careerRes.value : [])
        setTrophies(trophiesRes.status === 'fulfilled' ? trophiesRes.value : [])
        setTransfers(transfersRes.status === 'fulfilled' ? transfersRes.value : [])
      } catch (err) {
        if (signal?.aborted) return
        setAthlete(null)
        setCareer([])
        setTrophies([])
        setTransfers([])
        setError(classifyError(err))
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

  return {
    athlete,
    career,
    trophies,
    transfers,
    loading,
    error,
    refetch: () => fetch(),
  }
}