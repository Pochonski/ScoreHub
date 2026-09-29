export interface AthletePosition {
  id: number
  name: string
}

export interface Athlete {
  id: number
  name: string
  shortName?: string
  age?: number
  position?: AthletePosition
  formationPosition?: AthletePosition
  nationalTeamId?: number
  clubId?: number
  nationalTeamStatsText?: string
  shortBio?: string
  photoUrl?: string
  thumbnailUrl?: string
  jerseyNum?: number
  nationalityName?: string
  /** Id del club del que viene cedido (si aplica). */
  onLoanFrom?: number | null
  onLoanUntil?: string
  /** Ficha (nacimiento, altura, pie hábil…) tal como viene del upstream. */
  playerDetails?: AthleteDetail[]
  /** Stats destacadas por competición (ya resueltas: nombre + valor). */
  highlightStats?: AthleteHighlightGroup[]
  /** Últimos partidos con minutos y rating. */
  lastMatches?: AthleteLastMatch[]
}

export interface AthleteDetail {
  title: string
  value: string
}

export interface AthleteHighlightStat {
  name: string
  shortName?: string
  value: string
  isTop?: boolean
}

export interface AthleteHighlightGroup {
  name: string
  stats: AthleteHighlightStat[]
}

export interface AthleteLastMatchTeam {
  name: string
  score?: number | null
}

export interface AthleteLastMatch {
  gameId: number
  startTime?: string
  competitionName?: string
  statusText?: string
  home: AthleteLastMatchTeam
  away: AthleteLastMatchTeam
  played: boolean
  didNotPlayReason?: string
  minutes?: number | null
  rating?: { value: string; bgColor?: string | null } | null
}

export interface AthleteCareerSeason {
  seasonKey: string
  name: string
  stats: {
    categories: unknown[]
    tables: unknown[]
  }
}

export interface AthleteTrophy {
  name: string
  count: number
  competitionId?: number
}

export interface AthleteTrophyCategory {
  name: string
  trophies: AthleteTrophy[]
}

export interface AthleteTransfer {
  date: string
  competitorId: number
  competitorName?: string | null
  competitorBadge?: string | null
  transferTitle: string
  contractUntil?: string
}
