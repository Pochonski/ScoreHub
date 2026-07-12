import { memo } from 'react'
import { LiveIndicator } from '@/presentation/components/ui/LiveIndicator'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import type { Game } from '@/domain/entities/Game'
import { formatDate, formatTime } from '@/presentation/utils/dates'

interface MatchScoreCardProps {
  game: Game
}

export const MatchScoreCard = memo(function MatchScoreCard({ game }: MatchScoreCardProps) {
  const isUpcoming = game.status === 'upcoming'
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="px-6 py-6 text-center sm:py-8">
        <div className="mb-4 flex items-center justify-center gap-3">
          <LiveIndicator status={game.status} minute={game.minute} />
          {game.stage && (
            <span className="text-text-muted font-body text-xs tracking-wider uppercase">{game.stage}</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <div className="flex min-w-0 flex-col items-center gap-2">
            <TeamBadge src={game.homeTeam.badgeUrl} name={game.homeTeam.name} size="lg" />
            <span className="font-body text-text-primary max-w-[120px] truncate text-sm font-semibold">
              {game.homeTeam.name}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
              {game.homeTeam.score != null && game.awayTeam.score != null
                ? `${game.homeTeam.score} — ${game.awayTeam.score}`
                : 'vs'}
            </span>
            {isUpcoming && (
              <p className="font-body text-text-muted text-xs">
                {formatDate(game.startTime)} · {formatTime(game.startTime)}
              </p>
            )}
            {isLive && game.statusText && (
              <span className="font-body text-accent-live text-xs">{game.statusText}</span>
            )}
            {isFinished && (
              <span className="font-body text-text-dim text-[10px] tracking-wider uppercase">Finalizado</span>
            )}
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2">
            <TeamBadge src={game.awayTeam.badgeUrl} name={game.awayTeam.name} size="lg" />
            <span className="font-body text-text-primary max-w-[120px] truncate text-sm font-semibold">
              {game.awayTeam.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
