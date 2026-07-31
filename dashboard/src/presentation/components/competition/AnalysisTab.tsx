import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BettingTip } from '@/domain/entities/BettingTip'
import type { Game } from '@/domain/entities/Game'
import { BettingTrends } from '@/presentation/components/trends/BettingTrends'
import { MatchTips } from '@/presentation/components/trends/MatchTips'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { useFeaturedGame } from '@/presentation/hooks/useGames'
import { useTrends } from '@/presentation/hooks/useTrends'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

interface PredictionItem {
  name: string
  value: number
}

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

/**
 * MatchAnalysisHeader — cabecera premium que deja claro de qué partido es el
 * análisis. Muestra los equipos con escudo, el estado (próximo / en vivo /
 * finalizado) con marcador o fecha, y enlaza al detalle del partido.
 */
function MatchAnalysisHeader({
  game,
  competitionName,
}: {
  game: Game
  competitionName?: string
}) {
  const navigate = useNavigate()
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isUpcoming = !isLive && !isFinished

  const statusLabel = isLive ? 'En vivo' : isFinished ? 'Finalizado' : 'Próximo partido'
  const context = [competitionName, game.stageName].filter(Boolean).join(' · ')

  const homeScore = game.homeTeam.score
  const awayScore = game.awayTeam.score
  const hasScore = homeScore != null && awayScore != null

  return (
    <button
      type="button"
      onClick={() => navigate(`/partido/${game.id}`)}
      className="focus-visible group block w-full text-left"
      aria-label={`Ver detalles: ${game.homeTeam.name} vs ${game.awayTeam.name}`}
    >
      <div className="border-border-card from-bg-elevated/50 to-bg-card relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-colors group-hover:border-accent-gold/30">
        {/* Contexto + estado */}
        <div className="mb-4 flex items-center justify-between gap-2">
          {context && (
            <span className="font-body text-text-dim truncate text-[11px] font-semibold uppercase tracking-wider">
              {context}
            </span>
          )}
          <span
            className={`font-body shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isLive
                ? 'bg-accent-green/15 text-accent-green'
                : isFinished
                  ? 'bg-bg-elevated text-text-muted'
                  : 'bg-accent-gold/15 text-accent-gold'
            }`}
          >
            {isLive && (
              <span className="bg-accent-green mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full align-middle" />
            )}
            {statusLabel}
          </span>
        </div>

        {/* Matchup */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <TeamBadge src={game.homeTeam.badgeUrl ?? null} name={game.homeTeam.name} size="md" />
            <span className="font-display text-text-primary truncate text-lg font-bold">
              {game.homeTeam.name}
            </span>
          </div>

          <div className="shrink-0 px-2 text-center">
            {hasScore ? (
              <div className="font-display text-text-primary text-2xl font-bold tabular-nums">
                {homeScore}
                <span className="text-text-dim mx-1.5">–</span>
                {awayScore}
              </div>
            ) : (
              <div className="font-display text-text-dim text-lg font-bold">VS</div>
            )}
            <div className="font-mono text-text-dim mt-0.5 text-[10px]">
              {isUpcoming ? formatKickoff(game.startTime) : game.statusText || ''}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <span className="font-display text-text-primary truncate text-right text-lg font-bold">
              {game.awayTeam.name}
            </span>
            <TeamBadge src={game.awayTeam.badgeUrl ?? null} name={game.awayTeam.name} size="md" />
          </div>
        </div>

        <div className="font-body text-text-dim group-hover:text-accent-gold mt-3 text-center text-[11px] transition-colors">
          Ver detalles del partido →
        </div>
      </div>
    </button>
  )
}

/**
 * AnalysisTab — análisis de apuestas por competición. Se enfoca en el partido
 * destacado (predicciones + tips) y las tendencias de la competición. Las
 * estadísticas del torneo y el once ideal viven en el tab «Estadísticas».
 */
export function AnalysisTab({
  competitionId,
  competitionName,
}: {
  competitionId?: number
  competitionName?: string
  seasonNum?: number
}) {
  const { game: featured, loading: featuredLoading } = useFeaturedGame(competitionId)
  const { trends, loading: trendsLoading } = useTrends(competitionId)
  const [featuredTips, setFeaturedTips] = useState<BettingTip | null>(null)
  const [featuredPredictions, setFeaturedPredictions] = useState<PredictionItem[]>([])

  const hasTips = featuredTips != null && featuredTips.topTrends.length > 0

  useEffect(() => {
    if (!featured?.id) {
      setFeaturedPredictions([])
      setFeaturedTips(null)
      return
    }
    Promise.all([
      apiClient.get<PredictionItem[]>(ENDPOINTS.matchPredictions(featured.id)).catch(() => []),
      apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(featured.id)).catch(() => null),
    ]).then(([preds, tips]) => {
      setFeaturedPredictions(preds)
      setFeaturedTips(tips)
    })
  }, [featured?.id])

  const hasPredictions = featuredPredictions.length > 0
  const hasTrends = !trendsLoading && trends.length > 0
  const hasMatchBetting = hasPredictions || hasTips

  if (featuredLoading || trendsLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-bg-card border-border-card skeleton h-32 rounded-2xl border" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="bg-bg-card border-border-card skeleton h-64 rounded-xl border" />
          <div className="bg-bg-card border-border-card skeleton h-64 rounded-xl border" />
        </div>
      </div>
    )
  }

  if (!featured && !hasTrends) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">
          Análisis de apuestas no disponible para esta competición
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {featured && <MatchAnalysisHeader game={featured} competitionName={competitionName} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {hasPredictions && (
            <section>
              <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Predicciones</h2>
              <div className="bg-bg-card border-border-card rounded-xl border p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {featuredPredictions.map((p, i) => (
                    <div
                      key={i}
                      className="bg-bg-elevated/50 flex items-center justify-between rounded-lg p-2"
                    >
                      <span className="font-body text-text-primary text-sm">{p.name}</span>
                      <span className="font-display text-accent-gold text-base font-bold">{p.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {hasTips && (
            <section>
              <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Tips del partido</h2>
              <div className="bg-bg-card border-border-card rounded-xl border p-4">
                <MatchTips tips={featuredTips} />
              </div>
            </section>
          )}

          {!hasMatchBetting && (
            <div className="bg-bg-card border-border-card rounded-xl border p-6 text-center">
              <p className="font-body text-text-muted text-sm">
                {!featured
                  ? 'Sin partido destacado para analizar'
                  : featured.status === 'finished'
                    ? 'Sin análisis de apuestas para este partido'
                    : 'Sin predicciones ni tips para este partido todavía'}
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-6">{hasTrends && <BettingTrends trends={trends} />}</aside>
      </div>
    </div>
  )
}
