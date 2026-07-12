import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'

export interface AthleteRepository {
  searchAthletes(query: string, teamId?: number): Promise<Athlete[]>
  getAthleteById(id: number): Promise<Athlete | null>
  getAthleteCareer(id: number): Promise<AthleteCareerSeason[]>
  getAthleteTrophies(id: number): Promise<AthleteTrophyCategory[]>
  getAthleteTransfers(id: number): Promise<AthleteTransfer[]>
}
