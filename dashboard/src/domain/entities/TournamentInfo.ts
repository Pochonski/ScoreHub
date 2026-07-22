export interface TournamentInfo {
  id: number
  name: string
  nameForURL?: string
  countryId?: number
  countryName?: string
  seasonNum: number
  seasonLabel?: string
  imageVersion?: number
  hasBrackets?: boolean
  hasGroups?: boolean
}
