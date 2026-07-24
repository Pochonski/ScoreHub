import { useQuery } from '@tanstack/react-query'
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

interface AthleteProfileResult {
  athlete: Athlete | null
  career: AthleteCareerSeason[]
  trophies: AthleteTrophyCategory[]
  transfers: AthleteTransfer[]
  error: ProfileError | null
}

/**
 * TanStack Query version. External shape preserved:
 * returns { athlete, career, trophies, transfers, loading, error, refetch }.
 */
export function useAthleteProfile(id: number | null) {
  const qKey = ['athlete-profile', id] as const
  const valid = isValidAthleteId(id) ? (id as number) : null

  const { data, isLoading, refetch } = useQuery<AthleteProfileResult>({
    queryKey: qKey,
    enabled: valid != null,
    queryFn: async () => {
      if (!isValidAthleteId(id)) {
        return { athlete: null, career: [], trophies: [], transfers: [], error: { kind: 'invalid_id' } }
      }
      const aid = id as number
      try {
        const a = await repo.getAthleteById(aid)
        if (!a) {
          return { athlete: null, career: [], trophies: [], transfers: [], error: { kind: 'not_found' } }
        }

        // Non-fatal supplements: failures leave the field empty but keep athlete.
        const results = await Promise.allSettled([
          repo.getAthleteCareer(aid),
          repo.getAthleteTrophies(aid),
          repo.getAthleteTransfers(aid),
        ])
        const [careerRes, trophiesRes, transfersRes] = results
        return {
          athlete: a,
          career: careerRes.status === 'fulfilled' ? careerRes.value : [],
          trophies: trophiesRes.status === 'fulfilled' ? trophiesRes.value : [],
          transfers: transfersRes.status === 'fulfilled' ? transfersRes.value : [],
          error: null,
        }
      } catch (err) {
        return {
          athlete: null,
          career: [],
          trophies: [],
          transfers: [],
          error: classifyError(err),
        }
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const fallback: AthleteProfileResult = valid == null
    ? { athlete: null, career: [], trophies: [], transfers: [], error: null }
    : (data ?? { athlete: null, career: [], trophies: [], transfers: [], error: null })

  return {
    ...fallback,
    loading: isLoading,
    error: fallback.error,
    refetch: () => refetch(),
  }
}
