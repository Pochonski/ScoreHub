import type { HistoryEdition } from '@/domain/entities/HistoryEdition'
import type { HistoryStats } from '@/domain/entities/HistoryStats'
import type { HistoricalMatchStats } from '@/domain/entities/HistoricalMatchStats'
import type { HistoricalMatchLineup } from '@/domain/entities/HistoricalMatchLineup'

export interface HistoryRepository {
  getHistory(competitionId?: number): Promise<HistoryEdition[]>
  getHistoryStats(competitionId?: number): Promise<HistoryStats>
  getHistoryBySeason(seasonNum: number, competitionId?: number): Promise<HistoryEdition | null>
  getHistoryMatchStats(seasonNum: number, competitionId?: number): Promise<HistoricalMatchStats | null>
  getHistoryMatchLineup(seasonNum: number, competitionId?: number): Promise<HistoricalMatchLineup | null>
}
