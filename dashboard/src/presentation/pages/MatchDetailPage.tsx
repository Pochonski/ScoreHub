import { useParams, useNavigate } from 'react-router-dom'
import { useGameDetail } from '@/presentation/hooks/useGameDetail'
import { MatchHeader } from '@/presentation/components/match-detail/MatchHeader'
import { MatchScoreCard } from '@/presentation/components/match-detail/MatchScoreCard'
import { MatchStatsTable } from '@/presentation/components/match-detail/MatchStatsTable'
import { MatchLineups } from '@/presentation/components/match-detail/MatchLineups'
import { MatchTimeline } from '@/presentation/components/match-detail/MatchTimeline'
import { MatchPredictions } from '@/presentation/components/match-detail/MatchPredictions'
import { MatchTips } from '@/presentation/components/match-detail/MatchTips'
import { MatchSuggestions } from '@/presentation/components/match-detail/MatchSuggestions'
import { MatchNews } from '@/presentation/components/match-detail/MatchNews'

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const gameId = id ? parseInt(id, 10) : null
  const { game, stats, lineups, timeline, predictions, tips, suggestions, news, loading } =
    useGameDetail(gameId)

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="bg-bg-elevated skeleton h-8 w-48 rounded" />
        <div className="bg-bg-card skeleton h-40 rounded-xl" />
        <div className="bg-bg-card skeleton h-48 rounded-xl" />
        <div className="bg-bg-card skeleton h-64 rounded-xl" />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="font-body text-text-muted mb-4 text-sm">Partido no encontrado</p>
        <button
          onClick={() => navigate('/')}
          className="bg-accent-gold/10 text-accent-gold font-body hover:bg-accent-gold/20 focus-visible rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <MatchHeader />
      <MatchScoreCard game={game} />
      <MatchStatsTable stats={stats} />
      <MatchLineups game={game} lineups={lineups} />
      <MatchTimeline timeline={timeline} />
      <MatchPredictions predictions={predictions} />
      <MatchTips tips={tips} />
      <MatchSuggestions game={game} suggestions={suggestions} />
      <MatchNews news={news} />
    </div>
  )
}
