import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'

export type RepoOptions = { signal?: AbortSignal }

export interface AthleteRepository {
  searchAthletes(query: string, teamId?: number, options?: RepoOptions): Promise<Athlete[]>
  getAthleteById(id: number, options?: RepoOptions): Promise<Athlete | null>
  getAthleteCareer(id: number, options?: RepoOptions): Promise<AthleteCareerSeason[]>
  getAthleteTrophies(id: number, options?: RepoOptions): Promise<AthleteTrophyCategory[]>
  getAthleteTransfers(id: number, options?: RepoOptions): Promise<AthleteTransfer[]>
}