import { memo, useEffect, useRef, useState, useCallback } from 'react'
import type { Game } from '@/domain/entities/Game'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { LiveIndicator } from '@/presentation/components/ui/LiveIndicator'
import { formatShortDate, formatShortTime } from '@/presentation/utils/dates'

interface MatchCardProps {
  game: Game
  onSelect?: (game: Game) => void
  compact?: boolean
}

export const MatchCard = memo(function MatchCard({ game, onSelect, compact = false }: MatchCardProps) {
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const hasScore = game.homeTeam.score != null && game.awayTeam.score != null
  const [animate, setAnimate] = useState(false)
  const prevHomeRef = useRef(game.homeTeam.score)
  const prevAwayRef = useRef(game.awayTeam.score)

  useEffect(() => {
    if (
      (prevHomeRef.current != null &&
        game.homeTeam.score != null &&
        prevHomeRef.current !== game.homeTeam.score) ||
      (prevAwayRef.current != null &&
        game.awayTeam.score != null &&
        prevAwayRef.current !== game.awayTeam.score)
    ) {
      setAnimate(true)
      const timer = setTimeout(() => setAnimate(false), 600)
      prevHomeRef.current = game.homeTeam.score
      prevAwayRef.current = game.awayTeam.score
      return () => clearTimeout(timer)
    }
    prevHomeRef.current = game.homeTeam.score
    prevAwayRef.current = game.awayTeam.score
  }, [game.homeTeam.score, game.awayTeam.score])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect?.(game)
      }
    },
    [game, onSelect]
  )

  return (
    <div
      className={`bg-bg-card border-border-card hover:border-border-hover focus-visible cursor-pointer rounded-xl border transition-all duration-200 ${
        isLive ? 'ring-accent-live/20 ring-1' : ''
      } ${compact ? 'min-w-[160px] p-3' : 'p-4'}`}
      onClick={() => onSelect?.(game)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${game.homeTeam.name} vs ${game.awayTeam.name}${hasScore ? `, ${game.homeTeam.score} - ${game.awayTeam.score}` : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <LiveIndicator status={game.status} minute={game.minute} />
        {game.stage !== 'Fase de grupos' && game.stage ? (
          <span className="text-text-dim font-body text-[10px] tracking-wider uppercase">{game.stage}</span>
        ) : null}
        {isFinished && hasScore && <span className="text-text-dim font-body text-[10px]">Final</span>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamBadge src={game.homeTeam.badgeUrl} name={game.homeTeam.name} size={compact ? 'sm' : 'md'} />
          <span
            className={`font-body text-text-primary truncate ${compact ? 'text-xs' : 'text-sm font-medium'}`}
          >
            {game.homeTeam.name}
          </span>
        </div>

        <div
          className={`font-display text-text-primary flex shrink-0 items-center gap-1 font-bold ${
            compact ? 'text-2xl' : 'text-3xl'
          }`}
        >
          {game.status === 'upcoming' && !hasScore ? (
            <span
              className={`font-body text-text-dim font-semibold ${compact ? 'text-xs' : 'text-sm'} tracking-widest`}
            >
              VS
            </span>
          ) : (
            <>
              <span className={animate ? 'score-animate' : ''}>{hasScore ? game.homeTeam.score : '-'}</span>
              <span className={compact ? 'text-base' : 'text-xl'}>:</span>
              <span className={animate ? 'score-animate' : ''}>{hasScore ? game.awayTeam.score : '-'}</span>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span
            className={`font-body text-text-primary truncate ${compact ? 'text-xs' : 'text-sm font-medium'}`}
          >
            {game.awayTeam.name}
          </span>
          <TeamBadge src={game.awayTeam.badgeUrl} name={game.awayTeam.name} size={compact ? 'sm' : 'md'} />
        </div>
      </div>

      {!compact && game.status === 'upcoming' && (
        <div className="mt-2 text-center">
          <span className="text-text-dim font-mono text-xs">
            {formatShortDate(game.startTime)} · {formatShortTime(game.startTime)}
          </span>
        </div>
      )}
    </div>
  )
})
