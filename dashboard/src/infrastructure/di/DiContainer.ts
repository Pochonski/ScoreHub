import type { AthleteRepository } from '@/domain/repositories/AthleteRepository'
import type { TeamRepository } from '@/domain/repositories/TeamRepository'
import type { HistoryRepository } from '@/domain/repositories/HistoryRepository'
import type { TournamentInfoRepository } from '@/domain/repositories/TournamentInfoRepository'
import type { StandingRepository } from '@/domain/repositories/StandingRepository'
import type { GameRepository } from '@/domain/repositories/GameRepository'
import type { NewsRepository } from '@/domain/repositories/NewsRepository'
import type { TournamentStatsRepository } from '@/domain/repositories/TournamentStatsRepository'
import type { BettingTipRepository } from '@/domain/repositories/BettingTipRepository'
import type { BracketRepository } from '@/domain/repositories/BracketRepository'
import type { CompetitionRepository } from '@/domain/repositories/CompetitionRepository'
import { ApiGameRepository } from '@/data/repositories/ApiGameRepository'
import { ApiNewsRepository } from '@/data/repositories/ApiNewsRepository'
import { ApiTournamentStatsRepository } from '@/data/repositories/ApiTournamentStatsRepository'
import { ApiBettingTipRepository } from '@/data/repositories/ApiBettingTipRepository'
import { ApiAthleteRepository } from '@/data/repositories/ApiAthleteRepository'
import { ApiTeamRepository } from '@/data/repositories/ApiTeamRepository'
import { ApiHistoryRepository } from '@/data/repositories/ApiHistoryRepository'
import { ApiTournamentInfoRepository } from '@/data/repositories/ApiTournamentInfoRepository'
import { ApiStandingRepository } from '@/data/repositories/ApiStandingRepository'
import { ApiBracketRepository } from '@/data/repositories/ApiBracketRepository'
import { ApiCompetitionRepository } from '@/data/repositories/ApiCompetitionRepository'

export class DiContainer {
  private static instance: DiContainer
  private repos = new Map<string, unknown>()

  private constructor() {}

  private getOrCreate<T>(key: string, factory: () => T): T {
    if (!this.repos.has(key)) {
      this.repos.set(key, factory())
    }
    return this.repos.get(key) as T
  }

  static getInstance(): DiContainer {
    if (!DiContainer.instance) {
      DiContainer.instance = new DiContainer()
    }
    return DiContainer.instance
  }

  getGameRepository(): GameRepository {
    return this.getOrCreate('game', () => new ApiGameRepository())
  }

  getNewsRepository(): NewsRepository {
    return this.getOrCreate('news', () => new ApiNewsRepository())
  }

  getTournamentStatsRepository(): TournamentStatsRepository {
    return this.getOrCreate('tStats', () => new ApiTournamentStatsRepository())
  }

  getBettingTipRepository(): BettingTipRepository {
    return this.getOrCreate('betting', () => new ApiBettingTipRepository())
  }

  getAthleteRepository(): AthleteRepository {
    return this.getOrCreate('athlete', () => new ApiAthleteRepository())
  }

  getTeamRepository(): TeamRepository {
    return this.getOrCreate('team', () => new ApiTeamRepository())
  }

  getHistoryRepository(): HistoryRepository {
    return this.getOrCreate('history', () => new ApiHistoryRepository())
  }

  getTournamentInfoRepository(): TournamentInfoRepository {
    return this.getOrCreate('tInfo', () => new ApiTournamentInfoRepository())
  }

  getStandingRepository(): StandingRepository {
    return this.getOrCreate('standing', () => new ApiStandingRepository())
  }

  getBracketRepository(): BracketRepository {
    return this.getOrCreate('bracket', () => new ApiBracketRepository())
  }

  getCompetitionRepository(): CompetitionRepository {
    return this.getOrCreate('competition', () => new ApiCompetitionRepository())
  }
}
