import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BettingTip, Trend } from '@/domain/entities/BettingTip'
import type { Game } from '@/domain/entities/Game'
import { BettingTrends } from '@/presentation/components/trends/BettingTrends'
import { BetTrendRow } from '@/presentation/components/trends/BetTrendRow'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { useGames, useFeaturedGame } from '@/presentation/hooks/useGames'
import { useMatchTipsForGames } from '@/presentation/hooks/useMatchTips'
import { useTrends } from '@/presentation/hooks/useTrends'

const MAX_MATCHES = 6

function formatKickoff(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
  } catch {
    return ''
  }
}

/** Dedup por apuesta, quedándose con el porcentaje más alto. */
function dedupe(trends: Trend[]): Trend[] {
  const best = new Map<string, Trend>()
  for (const t of trends) {
    const key = t.betCTA || t.text
    const cur = best.get(key)
    if (!cur || t.percentage > cur.percentage) best.set(key, t)
  }
  return Array.from(best.values()).sort((a, b) => b.percentage - a.percentage)
}

/**
 * MatchTipCard — tarjeta premium de análisis de un partido: cabecera con los
 * equipos + estado/fecha (enlaza al detalle) y sus mejores tips de apuestas.
 */
function MatchTipCard({ game, tips }: { game: Game; tips: BettingTip | null }) {
  const navigate = useNavigate()
  const topTips = useMemo(() => dedupe(tips?.topTrends ?? []), [tips])
  const confidence = tips ? Math.round(tips.confidenceScore * 100) : 0

  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isUpcoming = !isLive && !isFinished
  const hasScore = game.homeTeam.score != null && game.awayTeam.score != null

  return (
    <div className="bg-bg-card border-border-card flex flex-col overflow-hidden rounded-2xl border">
      {/* Cabecera del partido */}
      <button
        type="button"
        onClick={() => navigate(`/partido/${game.id}`)}
        className="focus-visible group block w-full text-left"
        aria-label={`Ver detalles: ${game.homeTeam.name} vs ${game.awayTeam.name}`}
      >
        <div className="from-bg-elevated/40 to-bg-card border-border-card/60 flex items-center gap-2 border-b bg-gradient-to-br px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
            <span className="font-body text-text-primary group-hover:text-accent-gold truncate text-sm font-semibold transition-colors">
              {game.homeTeam.name}
            </span>
            <TeamBadge src={game.homeTeam.badgeUrl ?? null} name={game.homeTeam.name} size="sm" />
          </div>

          <div className="shrink-0 px-1 text-center">
            {hasScore ? (
              <div className="font-display text-text-primary text-base font-bold tabular-nums">
                {game.homeTeam.score}
                <span className="text-text-dim mx-1">–</span>
                {game.awayTeam.score}
              </div>
            ) : (
              <div className="font-display text-text-dim text-sm font-bold">VS</div>
            )}
            <div className="font-mono text-text-dim mt-0.5 text-[9px] leading-tight">
              {isLive ? (
                <span className="text-accent-green">● {game.statusText || 'En vivo'}</span>
              ) : isUpcoming ? (
                formatKickoff(game.startTime)
              ) : (
                game.statusText || 'Finalizado'
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TeamBadge src={game.awayTeam.badgeUrl ?? null} name={game.awayTeam.name} size="sm" />
            <span className="font-body text-text-primary group-hover:text-accent-gold truncate text-sm font-semibold transition-colors">
              {game.awayTeam.name}
            </span>
          </div>
        </div>
      </button>

      {/* Tips */}
      <div className="flex-1 p-3">
        {topTips.length > 0 ? (
          <>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-body text-text-muted text-[10px] font-semibold uppercase tracking-wider">
                Tips del partido
              </span>
              <span className="font-mono text-accent-gold text-[11px]">{confidence}% confianza</span>
            </div>
            <div className="space-y-1.5">
              {topTips.slice(0, 3).map((t, i) => (
                <BetTrendRow key={i} trend={t} />
              ))}
            </div>
          </>
        ) : (
          <p className="font-body text-text-muted px-1 py-4 text-center text-xs">
            Sin tips para este partido
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * AnalysisTab — análisis de apuestas por competición. Muestra los próximos
 * partidos con sus tips (varios a la vez) y las tendencias de la competición.
 * Las estadísticas del torneo y el once ideal viven en el tab «Estadísticas».
 */
export function AnalysisTab({ competitionId }: { competitionId?: number; competitionName?: string; seasonNum?: number }) {
  const { games, loading: gamesLoading } = useGames({ competitionId })
  const { game: featured, loading: featuredLoading } = useFeaturedGame(competitionId)
  const { trends, loading: trendsLoading } = useTrends(competitionId)

  // Próximos partidos (en vivo o por jugar), ordenados por fecha; tope MAX_MATCHES.
  const upcoming = useMemo(() => {
    return games
      .filter((g) => g.status === 'upcoming' || g.status === 'live')
      .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
      .slice(0, MAX_MATCHES)
  }, [games])

  // Si no hay próximos (ej. torneo terminado), caemos al partido destacado.
  const analysisGames = useMemo(
    () => (upcoming.length > 0 ? upcoming : featured ? [featured] : []),
    [upcoming, featured]
  )

  const gameIds = useMemo(() => analysisGames.map((g) => g.id), [analysisGames])
  const { tipsByGame, loading: tipsLoading } = useMatchTipsForGames(gameIds)

  const matchesWithTips = useMemo(
    () => analysisGames.filter((g) => dedupe(tipsByGame.get(g.id)?.topTrends ?? []).length > 0),
    [analysisGames, tipsByGame]
  )

  // Cards a mostrar: los partidos con tips; si ninguno tiene, un card único
  // (el más próximo / destacado) para dejar claro de qué partido hablamos.
  const cards = matchesWithTips.length > 0 ? matchesWithTips : analysisGames.slice(0, 1)

  const hasTrends = !trendsLoading && trends.length > 0
  const initialLoading =
    gamesLoading ||
    featuredLoading ||
    (analysisGames.length > 0 && tipsLoading && matchesWithTips.length === 0)

  if (initialLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-bg-card border-border-card skeleton h-48 rounded-2xl border" />
          ))}
        </div>
      </div>
    )
  }

  if (cards.length === 0 && !hasTrends) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">
          Análisis de apuestas no disponible para esta competición
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {cards.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-text-primary text-lg font-semibold">
              {matchesWithTips.length > 1 ? 'Análisis de próximos partidos' : 'Análisis del partido'}
            </h2>
            {matchesWithTips.length > 0 && (
              <span className="font-body text-text-dim text-xs">
                {matchesWithTips.length} {matchesWithTips.length === 1 ? 'partido' : 'partidos'} con tips
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cards.map((g) => (
              <MatchTipCard key={g.id} game={g} tips={tipsByGame.get(g.id) ?? null} />
            ))}
          </div>
        </section>
      )}

      {hasTrends && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">
            Tendencias de la competición
          </h2>
          <div className="bg-bg-card border-border-card rounded-2xl border p-4">
            <BettingTrends trends={trends} />
          </div>
        </section>
      )}
    </div>
  )
}
