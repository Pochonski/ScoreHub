import type { TournamentStatEntry } from '@/domain/entities/BettingTip'

export interface TournamentStatsRepository {
  getTopScorers(competitionId?: number): Promise<TournamentStatEntry[]>
  getTopAssists(competitionId?: number): Promise<TournamentStatEntry[]>
  getTopRatings(competitionId?: number): Promise<TournamentStatEntry[]>
  getTeamOfWeek(competitionId?: number): Promise<unknown>
}
