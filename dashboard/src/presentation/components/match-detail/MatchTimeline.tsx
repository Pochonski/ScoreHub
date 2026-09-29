import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MatchEvent } from '@/domain/entities/Game'

interface MatchTimelineProps {
  timeline: MatchEvent[]
  homeTeamId?: number
  awayTeamId?: number
}

function EventIcon({ type }: { type: MatchEvent['type'] }) {
  switch (type) {
    case 'goal':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-text-primary"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5 10.8 6.5 9.7 9.8H6.3L5.2 6.5Z" strokeLinejoin="round" />
        </svg>
      )
    case 'yellow_card':
      return <span className="inline-block h-3.5 w-2.5 rounded-sm bg-yellow-400" aria-label="Tarjeta amarilla" />
    case 'red_card':
      return <span className="inline-block h-3.5 w-2.5 rounded-sm bg-red-500" aria-label="Tarjeta roja" />
    case 'substitution':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-muted"
          aria-hidden="true"
        >
          <path d="M2 5.5h8M7.5 3 10 5.5 7.5 8M14 10.5H6M8.5 8l-2.5 2.5L8.5 13" />
        </svg>
      )
    default:
      return null
  }
}

export const MatchTimeline = memo(function MatchTimeline({ timeline, homeTeamId, awayTeamId }: MatchTimelineProps) {
  const navigate = useNavigate()
  if (!timeline || timeline.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border-card bg-bg-card">
      <div className="border-b border-border-card/50 px-5 py-4">
        <h3 className="text-[11px] uppercase tracking-wider text-text-dim">Eventos del Partido</h3>
      </div>
      <div className="p-5">
        <ul className="space-y-1">
          {timeline.map((ev, i) => {
            const isAway = ev.teamId === awayTeamId && ev.teamId !== homeTeamId
            const minute = Math.floor(ev.minute)
            return (
              <li
                key={i}
                className={`flex items-center gap-3 py-1.5 text-sm ${
                  isAway ? 'flex-row-reverse text-right' : ''
                }`}
              >
                {/* Minuto */}
                <span className={`w-10 shrink-0 font-mono text-xs text-text-dim ${isAway ? 'text-left' : 'text-right'}`}>
                  {minute}'
                </span>
                {/* Icono */}
                <span className="flex w-5 shrink-0 items-center justify-center">
                  <EventIcon type={ev.type} />
                </span>
                {/* Descripción */}
                {ev.playerId != null ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/player/${ev.playerId}`)}
                    className={`font-body focus-visible min-h-[44px] flex-1 truncate text-left transition-colors hover:text-accent-gold hover:underline sm:min-h-0 ${ev.isMajor ? 'font-semibold text-text-primary' : 'text-text-muted'}`}
                    title="Ver ficha del jugador"
                  >
                    {ev.description || ev.playerName || ''}
                  </button>
                ) : (
                  <span className={`flex-1 truncate ${ev.isMajor ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>
                    {ev.description || ev.playerName || ''}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
})
