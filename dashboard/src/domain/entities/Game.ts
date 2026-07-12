export type GameStatus = 'live' | 'upcoming' | 'finished'
export type GameStatusGroup = 1 | 2 | 3 | 4

export interface TeamInfo {
  id: number
  name: string
  shortName?: string
  score?: number
  badgeUrl?: string
  flagUrl?: string
}

export interface MatchEvent {
  minute: number
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty'
  teamId: number
  playerName?: string
  description?: string
}

export interface GameStat {
  statId: number
  label: string
  homeValue: number | string
  awayValue: number | string
}

export interface Game {
  id: number
  statusGroup: GameStatusGroup
  status: GameStatus
  stage: string
  stageName: string
  groupNum?: number
  startTime: string
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  statusText?: string
  minute?: number
  events?: MatchEvent[]
  stats?: GameStat[]
}

export interface TeamStatEntry {
  name: string
  value: string
  group: number
}

export interface TeamStatsGroup {
  competitorId: number
  stats: TeamStatEntry[]
}

import type { LineupMember, Lineup } from './Lineup'
import type { Prediction, PredictionOption } from './Prediction'
export type { LineupMember, Lineup, Prediction, PredictionOption }
