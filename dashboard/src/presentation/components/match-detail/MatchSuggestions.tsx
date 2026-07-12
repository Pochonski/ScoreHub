import { memo } from 'react'
import type { Game } from '@/domain/entities/Game'
import { formatShortDate } from '@/presentation/utils/dates'

interface MatchSuggestionsProps {
  game: Game
  suggestions: Game[]
}

export const MatchSuggestions = memo(function MatchSuggestions({ game, suggestions }: MatchSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">Últimos Partidos</h3>
      </div>
      <div className="space-y-2 p-5">
        {suggestions.slice(0, 6).map((g, i) => {
          const homeScore = g.homeTeam.score ?? 0
          const awayScore = g.awayTeam.score ?? 0
          const isHome = g.homeTeam.id === game.homeTeam.id
          const opponent = isHome ? g.awayTeam : g.homeTeam
          const won = isHome ? homeScore > awayScore : awayScore > homeScore
          const drawn = homeScore === awayScore
          return (
            <div key={i} className="flex items-center justify-between py-1.5 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-text-dim truncate">{g.stage}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono ${won ? 'text-accent-live' : drawn ? 'text-text-muted' : 'text-accent-red'}`}
                >
                  {isHome ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`}
                </span>
                <span className="text-text-muted">vs</span>
                <span className="font-body text-text-primary max-w-[120px] truncate">{opponent.name}</span>
              </div>
              <span className="text-text-dim ml-2">{formatShortDate(g.startTime)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
