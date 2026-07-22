import type { Competition, CompetitionDetail } from '@/domain/entities/Competition'

export interface CompetitionRepository {
  getCompetitions(): Promise<Competition[]>
  getFeaturedCompetitions(): Promise<Competition[]>
  getCompetitionById(id: number): Promise<CompetitionDetail | null>
  getCompetitionSeasons(id: number): Promise<CompetitionDetail['seasons']>
}
