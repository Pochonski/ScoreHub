export interface Trend {
  id?: number
  text: string
  /** Fracción 0-1 (NO 0-100). La UI debe multiplicar ×100 al mostrar. */
  percentage: number
  betCTA?: string
  cause?: string
  isTop?: boolean
  lineTypeId: number
  /** Categoría legible de la apuesta (ej. "Ambos marcan", "Over/Under"). */
  lineTypeLabel?: string
  gameId?: number
  competitionId?: number
}

export interface BettingTip {
  gameId: number
  confidenceScore: number
  topTrends: Trend[]
  allTrends: Trend[]
  generatedAt: string
}

export interface TournamentStatEntry {
  athleteId: number
  name: string
  teamName: string
  value: number
  photoUrl?: string
}
