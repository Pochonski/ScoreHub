import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useGameDetail, type PartialError } from '@/presentation/hooks/useGameDetail'
import { useGameSuggestions } from '@/presentation/hooks/useTransfersAndMore'
import { mapRawGame } from '@/data/mappers/GameMapper'
import { ErrorState } from '@/presentation/components/ui/ErrorState'
import { MatchHeader } from '@/presentation/components/match-detail/MatchHeader'
import { MatchScoreCard } from '@/presentation/components/match-detail/MatchScoreCard'
import { MatchStatsTable } from '@/presentation/components/match-detail/MatchStatsTable'
import { MatchLineups } from '@/presentation/components/match-detail/MatchLineups'
import { MatchTimeline } from '@/presentation/components/match-detail/MatchTimeline'
import { MatchPlayByPlay } from '@/presentation/components/match-detail/MatchPlayByPlay'
import { MatchPreviewEmbed } from '@/presentation/components/match-detail/MatchPreviewEmbed'
import { MatchPredictions } from '@/presentation/components/match-detail/MatchPredictions'
import { MatchTips } from '@/presentation/components/match-detail/MatchTips'
import { MatchNews } from '@/presentation/components/match-detail/MatchNews'
import { MatchCard } from '@/presentation/components/matches/MatchCard'
import { ShareButton } from '@/presentation/components/ui/ShareButton'

const SECTION_LABELS: Record<PartialError['section'], string> = {
  game: 'Partido',
  stats: 'Estadísticas',
  lineups: 'Alineaciones',
  timeline: 'Eventos',
  predictions: 'Predicciones',
  tips: 'Tips',
  news: 'Noticias',
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const gameId = id ? parseInt(id, 10) : null
  const { game, stats, lineups, timeline, predictions, tips, news, loading, error, partialError, refetch } =
    useGameDetail(gameId)
  const { suggestions } = useGameSuggestions(game?.competitionId ?? null)

  const suggestedGames = useMemo(() => {
    if (!game) return []
    return suggestions
      .filter((s) => s.id !== game.id)
      .map((s) => {
        try {
          return mapRawGame(s)
        } catch {
          return null
        }
      })
      .filter((g): g is NonNullable<typeof g> => g != null)
      .slice(0, 6)
  }, [suggestions, game])

  // Scroll a la sección indicada por el hash (#alineaciones, #estadisticas)
  // una vez que el partido cargó. Complementa el ScrollToTop global, que solo
  // reacciona al pathname.
  useEffect(() => {
    if (loading || !game || !location.hash) return
    const el = document.querySelector(location.hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, game, location.hash])

  if (error) return <ErrorState message={error} fullPage />
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
      {partialError.length > 0 && (
        <div
          role="status"
          className="bg-accent-gold/10 border-accent-gold/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
        >
          <p className="font-body text-text-muted text-xs">
            No se pudieron cargar: {partialError.map((e) => SECTION_LABELS[e.section]).join(', ')}.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="font-body text-accent-gold hover:text-accent-gold/70 focus-visible rounded px-1 py-0.5 text-xs font-medium underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}
      <MatchScoreCard game={game} />
      {game.status !== 'finished' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate(`/partido/${game.id}/previa`)}
            className="font-body bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 focus-visible rounded-xl px-6 py-2.5 text-sm font-medium transition-colors"
          >
            Ver previa del partido →
          </button>
        </div>
      )}
      <div id="estadisticas" className="scroll-mt-20">
        <MatchStatsTable stats={stats} />
      </div>
      <div id="alineaciones" className="scroll-mt-20">
        <MatchLineups game={game} lineups={lineups} />
        {game.status === 'upcoming' && !lineups && (
          <div className="bg-bg-card border-border-card rounded-xl border px-5 py-6 text-center">
            <p className="font-body text-text-primary text-sm font-medium">Alineaciones aún no disponibles</p>
            <p className="font-body text-text-muted mt-1 text-xs">
              Se publican aproximadamente 1 hora antes del partido.
            </p>
          </div>
        )}
      </div>
      <MatchTimeline timeline={timeline} homeTeamId={game.homeTeam.id} awayTeamId={game.awayTeam.id} />
      <MatchPlayByPlay gameId={game.id} live={game.status === 'live'} />
      <MatchPreviewEmbed
        gameId={game.id}
        homeTeamId={game.homeTeam.id}
        awayTeamId={game.awayTeam.id}
        homeName={game.homeTeam.name}
        awayName={game.awayTeam.name}
        competitionId={game.competitionId}
      />
      <MatchPredictions predictions={predictions} />
      <MatchTips tips={tips} />
      {suggestedGames.length > 0 && (
        <section aria-label="Partidos sugeridos">
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Partidos sugeridos</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestedGames.map((g) => (
              <MatchCard key={g.id} game={g} onSelect={(sg) => navigate(`/partido/${sg.id}`)} />
            ))}
          </div>
        </section>
      )}
      <MatchNews news={news} />
      <div className="flex justify-center">
        <ShareButton
          title={`${game.homeTeam.name} vs ${game.awayTeam.name} · ScoreHub`}
        />
      </div>
    </div>
  )
}
