import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchPlayByPlay, type PlayByPlayMessage } from '@/presentation/hooks/useMatchPlayByPlay'

interface MatchPlayByPlayProps {
  gameId: number
  live: boolean
}

function MessageRow({ message }: { message: PlayByPlayMessage }) {
  const navigate = useNavigate()
  const mainPlayer = message.players[0]
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-xs text-text-dim">
        {message.minute != null ? `${message.minute}'` : '–'}
      </span>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${message.isMajor ? 'bg-accent-gold' : 'bg-text-dim/40'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {message.title && (
          <p className={`font-body text-[13px] font-semibold ${message.isMajor ? 'text-accent-gold' : 'text-text-primary'}`}>
            {message.title}
          </p>
        )}
        <p className="font-body text-text-muted text-[13px] leading-relaxed">{message.comment}</p>
        {mainPlayer?.athleteId != null && (
          <button
            type="button"
            onClick={() => navigate(`/player/${mainPlayer.athleteId}`)}
            className="font-body focus-visible text-accent-blue hover:text-accent-blue/80 mt-0.5 rounded text-[11px] transition-colors"
          >
            Ver ficha: {mainPlayer.shortName || mainPlayer.name} →
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * Relato en vivo jugada a jugada (feed 365scores). Solo se muestra si hay
 * mensajes; en vivo pollea cada 30s.
 */
export const MatchPlayByPlay = memo(function MatchPlayByPlay({
  gameId,
  live,
}: MatchPlayByPlayProps) {
  const { messages, loading } = useMatchPlayByPlay(gameId, live)

  if (loading) {
    return <div className="bg-bg-card skeleton h-48 rounded-xl" aria-hidden="true" />
  }
  if (messages.length === 0) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 flex items-center justify-between border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[11px] sm:text-[10px] tracking-wider uppercase">
          Relato en vivo
        </h3>
        {live && (
          <span className="text-text-dim flex items-center gap-1.5 font-mono text-[11px]" aria-live="polite">
            <span className="bg-accent-live/60 h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" />
            Actualizando cada 30s
          </span>
        )}
      </div>
      <ul className="divide-border-card/30 max-h-[480px] divide-y overflow-y-auto px-5 py-2">
        {messages.map((m, i) => (
          <MessageRow key={i} message={m} />
        ))}
      </ul>
    </div>
  )
})
