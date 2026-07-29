import { memo } from 'react'
import type { Game } from '@/domain/entities/Game'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { formatShortTime } from '@/presentation/utils/dates'

interface CompactMatchRowProps {
  game: Game
  onSelect?: (game: Game) => void
}

/**
 * Fila compacta de partido para el rail izquierdo (estilo 365scores):
 * columna de estado/hora a la izquierda, y las dos filas de equipos
 * (local arriba, visitante abajo) con el marcador alineado a la derecha.
 */
export const CompactMatchRow = memo(function CompactMatchRow({ game, onSelect }: CompactMatchRowProps) {
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const hasScore = game.homeTeam.score != null && game.awayTeam.score != null
  const homeWon = hasScore && (game.homeTeam.score ?? 0) > (game.awayTeam.score ?? 0)
  const awayWon = hasScore && (game.awayTeam.score ?? 0) > (game.homeTeam.score ?? 0)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(game)}
      className="hover:bg-bg-elevated focus-visible group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
      aria-label={`${game.homeTeam.name} vs ${game.awayTeam.name}`}
    >
      {/* Columna estado/hora */}
      <div className="flex w-10 shrink-0 flex-col items-center justify-center">
        {isLive ? (
          <>
            <span className="bg-accent-live live-pulse mb-0.5 h-1.5 w-1.5 rounded-full" />
            <span className="text-accent-live font-mono text-[10px] font-bold leading-none">
              {game.minute != null ? `${game.minute}'` : 'EN VIVO'}
            </span>
          </>
        ) : isFinished ? (
          <span className="text-text-dim font-body text-[10px] font-semibold uppercase leading-tight">
            Fin
          </span>
        ) : (
          <span className="text-text-muted font-mono text-[11px] leading-tight">
            {formatShortTime(game.startTime)}
          </span>
        )}
      </div>

      {/* Divisor vertical */}
      <span className="bg-border-card h-8 w-px shrink-0" aria-hidden="true" />

      {/* Equipos */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <TeamBadge src={game.homeTeam.badgeUrl} name={game.homeTeam.name} size="xs" />
          <span
            className={`font-body min-w-0 flex-1 truncate text-[13px] ${
              awayWon ? 'text-text-muted' : 'text-text-primary'
            } ${homeWon ? 'font-semibold' : ''}`}
          >
            {game.homeTeam.name}
          </span>
          <span
            className={`font-display w-4 shrink-0 text-right text-sm font-bold tabular-nums ${
              isLive ? 'text-accent-live' : awayWon ? 'text-text-dim' : 'text-text-primary'
            }`}
          >
            {hasScore ? game.homeTeam.score : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TeamBadge src={game.awayTeam.badgeUrl} name={game.awayTeam.name} size="xs" />
          <span
            className={`font-body min-w-0 flex-1 truncate text-[13px] ${
              homeWon ? 'text-text-muted' : 'text-text-primary'
            } ${awayWon ? 'font-semibold' : ''}`}
          >
            {game.awayTeam.name}
          </span>
          <span
            className={`font-display w-4 shrink-0 text-right text-sm font-bold tabular-nums ${
              isLive ? 'text-accent-live' : homeWon ? 'text-text-dim' : 'text-text-primary'
            }`}
          >
            {hasScore ? game.awayTeam.score : ''}
          </span>
        </div>
      </div>
    </button>
  )
})
