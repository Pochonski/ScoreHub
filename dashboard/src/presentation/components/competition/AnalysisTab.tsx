import { useState, useEffect } from 'react'
import type { BettingTip } from '@/domain/entities/BettingTip'
import { TopScorers } from '@/presentation/components/stats/TopScorers'
import { Assists } from '@/presentation/components/stats/Assists'
import { Ratings } from '@/presentation/components/stats/Ratings'
import { TeamOfWeek, type TeamOfWeekPlayer } from '@/presentation/components/stats/TeamOfWeek'
import { BettingTrends } from '@/presentation/components/trends/BettingTrends'
import { MatchTips } from '@/presentation/components/trends/MatchTips'
import { useFeaturedGame } from '@/presentation/hooks/useGames'
import { useTournamentStats } from '@/presentation/hooks/useTournamentStats'
import { useTrends } from '@/presentation/hooks/useTrends'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

interface PredictionItem {
  name: string
  value: number
}

/**
 * AnalysisTab — versión por competición de la antigua página `/analisis`.
 * Todo (partido destacado, predicciones, tips, estadísticas del torneo,
 * once ideal y tendencias) se scopea al `competitionId` recibido.
 */
export function AnalysisTab({
  competitionId,
  seasonNum,
}: {
  competitionId?: number
  seasonNum?: number
}) {
  const { game: featured } = useFeaturedGame(competitionId)
  const { scorers, assists, ratings, teamOfWeek, loading: statsLoading } = useTournamentStats(
    competitionId,
    seasonNum
  )
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

  const hasStats = scorers.length > 0 || assists.length > 0 || ratings.length > 0
  const hasTeamOfWeek = !!teamOfWeek
  const hasTrends = !trendsLoading && trends.length > 0
  const hasAnything =
    featuredPredictions.length > 0 || hasTips || hasStats || hasTeamOfWeek || hasTrends

  if (statsLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="bg-bg-card border-border-card skeleton h-96 rounded-xl border" />
        <div className="bg-bg-card border-border-card skeleton h-64 rounded-xl border" />
      </div>
    )
  }

  if (!hasAnything) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">Análisis no disponible para esta competición</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        {featuredPredictions.length > 0 && (
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

        {hasStats && (
          <section>
            <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">
              Estadísticas del torneo
            </h2>
            <div className="bg-bg-card border-border-card space-y-5 rounded-xl border p-4">
              <TopScorers scorers={scorers} />
              <Assists assists={assists} />
              <Ratings ratings={ratings} />
            </div>
          </section>
        )}

        {hasTeamOfWeek && (
          <section>
            <TeamOfWeek {...(teamOfWeek as { formation: string; players: TeamOfWeekPlayer[] })} />
          </section>
        )}
      </div>

      <aside className="min-w-0 space-y-6">{hasTrends && <BettingTrends trends={trends} />}</aside>
    </div>
  )
}
