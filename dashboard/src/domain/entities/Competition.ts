export interface Competition {
  id: number
  displayName: string
  shortName: string | null
  countryId: number | null
  countryName: string | null
  seasonNum: number
  seasonLabel: string | null
  startDate: string | null
  endDate: string | null
  isFeatured: boolean
  displayOrder: number
  hasBrackets: boolean
  hasGroups: boolean
  hasHistory: boolean
}

export interface CompetitionDetail extends Competition {
  upstream: unknown
  seasons: Array<{ num: number; name?: string; startDate?: string; endDate?: string }>
}
