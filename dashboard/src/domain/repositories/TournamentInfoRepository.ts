import type { TournamentInfo } from '@/domain/entities/TournamentInfo'

export interface TournamentInfoRepository {
  getTournamentInfo(competitionId?: number): Promise<TournamentInfo>
}
