import type { StandingGroup } from '@/domain/entities/Standing'
import type { BracketStage } from '@/domain/entities/Bracket'

export interface StandingRepository {
  getStandings(competitionId?: number): Promise<StandingGroup[]>
  getBrackets(competitionId?: number): Promise<BracketStage[]>
}
