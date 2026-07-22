import type { Team } from '@/domain/entities/Team'
import type { Game } from '@/domain/entities/Game'

export interface TeamRepository {
  getTeams(nationalOnly?: boolean, competitionId?: number): Promise<Team[]>
  getTeamById(id: number): Promise<Team | null>
  getTeamMatches(id: number, competitionId?: number): Promise<Game[]>
}
