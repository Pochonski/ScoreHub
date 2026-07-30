import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import { LiveIndicator } from '@/presentation/components/ui/LiveIndicator'

interface FeaturedHeroProps {
  game: Game
  competitionName?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Cuenta regresiva viva hacia el saque. Devuelve null si faltan +24h. */
function useCountdown(targetIso: string): { h: number; m: number; s: number } | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = new Date(targetIso).getTime() - now
  if (isNaN(diff) || diff <= 0 || diff >= 24 * 3600 * 1000) return null
  const total = Math.floor(diff / 1000)
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 }
}

function TeamCrest({ name, badge }: { name: string; badge?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
      <div className="bg-bg-base/40 ring-border-card flex h-20 w-20 items-center justify-center rounded-full p-1.5 ring-1">
        {badge ? (
          <img src={badge} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="font-display text-text-muted text-3xl font-bold">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="font-body text-text-primary line-clamp-2 max-w-[10rem] text-center text-base font-semibold">
        {name}
      </span>
    </div>
  )
}

const QUICK_LINKS = [
  { key: 'pagina', label: 'Página del partido', hash: '' },
  { key: 'alineaciones', label: 'Alineaciones', hash: '#alineaciones' },
  { key: 'estadisticas', label: 'Estadísticas', hash: '#estadisticas' },
] as const

export function FeaturedHero({ game, competitionName }: FeaturedHeroProps) {
  const navigate = useNavigate()
  const isLive = game.status === 'live'
  const isUpcoming = game.status === 'upcoming'
  const isFinished = game.status === 'finished'
  const hasScore = game.homeTeam.score != null && game.awayTeam.score != null
  const countdown = useCountdown(game.startTime)

  const go = (hash: string) => navigate(`/partido/${game.id}${hash}`)

  const kickoff = new Date(game.startTime)
  const validKickoff = !isNaN(kickoff.getTime())
  const kickoffTime = validKickoff
    ? kickoff.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
    : ''
  const kickoffDate = validKickoff
    ? kickoff.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="border-border-card relative overflow-hidden rounded-2xl border">
      {/* Escudos gigantes de fondo (marca de agua) */}
      {game.homeTeam.badgeUrl && (
        <img
          src={game.homeTeam.badgeUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -left-10 h-56 w-56 -translate-y-1/2 object-contain opacity-[0.06] blur-[1px]"
        />
      )}
      {game.awayTeam.badgeUrl && (
        <img
          src={game.awayTeam.badgeUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -right-10 h-56 w-56 -translate-y-1/2 object-contain opacity-[0.06] blur-[1px]"
        />
      )}
      {/* Fondo con degradado + split sutil */}
      <div className="from-bg-elevated via-bg-card to-bg-elevated absolute inset-0 bg-gradient-to-r" aria-hidden="true" />
      <div className="from-bg-base/60 absolute inset-0 bg-gradient-to-t to-transparent" aria-hidden="true" />

      <div className="relative px-6 pt-5 pb-6">
        {/* Cabecera: competición · etapa + badge según estado */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="font-body text-text-muted truncate text-xs font-medium tracking-wider uppercase">
            {[competitionName, game.stageName || game.stage].filter(Boolean).join(' · ') || 'Partido'}
          </span>
          <span
            className={`font-body shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
              isLive
                ? 'bg-accent-live/15 text-accent-live'
                : isFinished
                  ? 'bg-bg-elevated text-text-muted'
                  : 'bg-accent-gold/15 text-accent-gold'
            }`}
          >
            {isLive ? 'En vivo' : isFinished ? 'Último resultado' : 'Partido destacado'}
          </span>
        </div>

        {/* Equipos + marcador / countdown */}
        <div className="flex items-center justify-between gap-3">
          <TeamCrest name={game.homeTeam.name} badge={game.homeTeam.badgeUrl} />

          <div className="flex min-w-[7.5rem] shrink-0 flex-col items-center gap-1.5 px-1">
            {isLive && <LiveIndicator status="live" minute={game.minute} />}
            {isUpcoming ? (
              countdown ? (
                <>
                  <span className="text-text-dim font-body text-[10px] font-semibold tracking-wider uppercase">
                    Comienza en
                  </span>
                  <div className="font-display text-accent-gold text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
                    {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
                  </div>
                </>
              ) : (
                <div className="font-display text-text-primary text-4xl font-bold tabular-nums sm:text-5xl">
                  {kickoffTime}
                </div>
              )
            ) : hasScore ? (
              <div className="font-display text-text-primary flex items-center gap-2 text-4xl font-bold tabular-nums sm:text-5xl">
                <span className={isFinished && (game.homeTeam.score ?? 0) < (game.awayTeam.score ?? 0) ? 'text-text-muted' : ''}>
                  {game.homeTeam.score}
                </span>
                <span className="text-text-dim text-2xl">:</span>
                <span className={isFinished && (game.awayTeam.score ?? 0) < (game.homeTeam.score ?? 0) ? 'text-text-muted' : ''}>
                  {game.awayTeam.score}
                </span>
              </div>
            ) : (
              <div className="font-display text-text-dim text-2xl font-bold tracking-widest">VS</div>
            )}
            {isFinished && (
              <span className="text-text-dim font-body max-w-[11rem] text-center text-[11px] font-semibold capitalize leading-tight">
                Final{kickoffDate ? ` · ${kickoffDate}` : ''}
              </span>
            )}
            {isUpcoming && kickoffDate && (
              <span className="text-text-muted font-body max-w-[10rem] text-center text-[11px] capitalize leading-tight">
                {kickoffDate}
              </span>
            )}
          </div>

          <TeamCrest name={game.awayTeam.name} badge={game.awayTeam.badgeUrl} />
        </div>

        {/* Accesos rápidos */}
        <div className="border-border-card mt-5 grid grid-cols-3 gap-2 border-t pt-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => go(link.hash)}
              className="font-body text-text-muted hover:bg-bg-elevated hover:text-text-primary focus-visible flex items-center justify-center rounded-lg px-2 py-2 text-xs font-medium transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
