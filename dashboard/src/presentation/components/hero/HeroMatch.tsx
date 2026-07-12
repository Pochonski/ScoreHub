import { useNavigate } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import { BroadcastScore } from './BroadcastScore'
import { LiveIndicator } from '@/presentation/components/ui/LiveIndicator'

interface HeroMatchProps {
  game: Game
  compact?: boolean
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

export function HeroMatch({ game, compact = false }: HeroMatchProps) {
  const navigate = useNavigate()
  const isLive = game.status === 'live'
  const isUpcoming = game.status === 'upcoming'

  const handleClick = () => {
    navigate(`/partido/${game.id}`)
  }

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="bg-bg-card border-border-card focus-visible w-full border-b px-4 py-2 text-left"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-bg-elevated h-8 w-8 shrink-0 overflow-hidden rounded-full">
              {game.homeTeam.badgeUrl && (
                <img src={game.homeTeam.badgeUrl} alt="" className="h-full w-full object-contain" />
              )}
            </div>
            <BroadcastScore
              homeScore={game.homeTeam.score}
              awayScore={game.awayTeam.score}
              homeTeam={game.homeTeam.name}
              awayTeam={game.awayTeam.name}
              homeBadge={game.homeTeam.badgeUrl}
              awayBadge={game.awayTeam.badgeUrl}
              isLive={isLive}
            />
            <div className="bg-bg-elevated h-8 w-8 shrink-0 overflow-hidden rounded-full">
              {game.awayTeam.badgeUrl && (
                <img src={game.awayTeam.badgeUrl} alt="" className="h-full w-full object-contain" />
              )}
            </div>
          </div>
          {isLive && <LiveIndicator status="live" minute={game.minute} />}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="from-bg-card to-bg-base border-border-card focus-visible w-full border-b bg-gradient-to-b text-left"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 md:py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <LiveIndicator status={game.status} minute={game.minute} />
            {game.stage && (
              <span className="text-text-muted font-body text-xs tracking-wider uppercase">{game.stage}</span>
            )}
          </div>

          <div aria-live={isLive ? 'polite' : 'off'} aria-atomic="true" role="status" aria-label="Marcador del partido destacado">
            <BroadcastScore
              homeScore={game.homeTeam.score}
              awayScore={game.awayTeam.score}
              homeTeam={game.homeTeam.name}
              awayTeam={game.awayTeam.name}
              homeBadge={game.homeTeam.badgeUrl}
              awayBadge={game.awayTeam.badgeUrl}
              isLive={isLive}
            />
          </div>

          {isUpcoming && (
            <div className="text-center">
              <p className="text-text-muted font-body text-sm">
                {formatDate(game.startTime)} · {formatTime(game.startTime)}
              </p>
            </div>
          )}

          {isLive && game.statusText && (
            <p className="text-text-muted font-body text-xs">{game.statusText}</p>
          )}
        </div>
      </div>
    </button>
  )
}
