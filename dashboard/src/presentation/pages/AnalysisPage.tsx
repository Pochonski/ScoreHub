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

export function AnalysisPage() {
  const { game: featured } = useFeaturedGame()
  const { scorers, assists, ratings, teamOfWeek, loading: statsLoading } = useTournamentStats()
  const { trends, loading: trendsLoading } = useTrends()
  const [featuredTips, setFeaturedTips] = useState<BettingTip | null>(null)
  const [featuredPredictions, setFeaturedPredictions] = useState<PredictionItem[]>([])

  const hasTips = featuredTips != null && featuredTips.topTrends.length > 0

  useEffect(() => {
    if (!featured?.id) return
    Promise.all([
      apiClient.get<PredictionItem[]>(ENDPOINTS.matchPredictions(featured.id)).catch(() => []),
      apiClient.get<BettingTip | null>(ENDPOINTS.matchTips(featured.id)).catch(() => null),
    ]).then(([preds, tips]) => {
      setFeaturedPredictions(preds)
      setFeaturedTips(tips)
    })
  }, [featured?.id])

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-display text-text-primary text-2xl font-bold sm:text-3xl">Análisis</h1>
        <p className="font-body text-text-muted mt-1 text-sm">
          Estadísticas del torneo, tendencias y noticias
        </p>
      </div>

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

          {!statsLoading && (scorers.length > 0 || assists.length > 0 || ratings.length > 0) && (
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

          {!!teamOfWeek && (
            <section>
              <TeamOfWeek {...(teamOfWeek as { formation: string; players: TeamOfWeekPlayer[] })} />
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6">{!trendsLoading && <BettingTrends trends={trends} />}</aside>
      </div>
    </div>
  )
}
