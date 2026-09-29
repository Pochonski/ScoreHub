import { useParams, useNavigate } from 'react-router-dom'
import { useMatchPreview } from '@/presentation/hooks/useMatchPreview'
import { MatchHeader } from '@/presentation/components/match-detail/MatchHeader'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { MatchPredictions } from '@/presentation/components/match-detail/MatchPredictions'
import { ShareButton } from '@/presentation/components/ui/ShareButton'
import { BetTrendRow } from '@/presentation/components/trends/BetTrendRow'
import { ErrorState } from '@/presentation/components/ui/ErrorState'
import { FormBadges, SectionCard } from '@/presentation/components/match-detail/PreviewShared'
import type { Game } from '@/domain/entities/Game'

export function PreviaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const gameId = id ? parseInt(id, 10) : null
  const { preview, loading, error, refetch } = useMatchPreview(gameId)

  if (error) return <ErrorState message={error} onRetry={() => refetch()} fullPage />
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="bg-bg-elevated skeleton h-8 w-48 rounded" />
        <div className="bg-bg-card skeleton h-40 rounded-xl" />
        <div className="bg-bg-card skeleton h-48 rounded-xl" />
      </div>
    )
  }
  if (!preview) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="font-body text-text-muted mb-4 text-sm">Previa no disponible</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-accent-gold/10 text-accent-gold font-body hover:bg-accent-gold/20 focus-visible rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Volver
        </button>
      </div>
    )
  }

  const game = preview.game
  const homeName = game?.homeTeam.name ?? 'Local'
  const awayName = game?.awayTeam.name ?? 'Visita'
  const when = game?.startTime
    ? new Date(game.startTime).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  const goGame = (g: Game) => navigate(`/partido/${g.id}`)
  const { home, away } = preview.table

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <MatchHeader />
      <div className="text-center">
        <p className="font-body text-text-dim text-[11px] tracking-wider uppercase">Previa del partido</p>
        <h1 className="font-display text-text-primary mt-1 text-3xl">
          {homeName} <span className="text-text-dim">vs</span> {awayName}
        </h1>
        {when && <p className="font-body text-text-muted mt-1 text-xs capitalize">{when}</p>}
      </div>

      <SectionCard title="Forma reciente (últimos 5)">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="font-body text-text-primary mb-2 text-sm font-semibold">{homeName}</p>
            <FormBadges teamId={preview.homeTeamId} entries={preview.form.home} />
          </div>
          <div>
            <p className="font-body text-text-primary mb-2 text-sm font-semibold">{awayName}</p>
            <FormBadges teamId={preview.awayTeamId} entries={preview.form.away} />
          </div>
        </div>
      </SectionCard>

      {(home || away) && (
        <SectionCard title="En la tabla">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono text-text-primary text-2xl font-bold">{home?.position ?? '–'}</p>
              <p className="font-body text-text-dim text-[11px] uppercase">{homeName}</p>
              <p className="font-body text-text-muted text-[11px]">
                {home?.points ?? '–'} pts · {home?.played ?? '–'} PJ
              </p>
            </div>
            <div className="flex items-center justify-center">
              <span className="font-body text-text-dim text-xs">POS · PTS · PJ</span>
            </div>
            <div>
              <p className="font-mono text-text-primary text-2xl font-bold">{away?.position ?? '–'}</p>
              <p className="font-body text-text-dim text-[11px] uppercase">{awayName}</p>
              <p className="font-body text-text-muted text-[11px]">
                {away?.points ?? '–'} pts · {away?.played ?? '–'} PJ
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {preview.h2h.h2hGames.length > 0 && (
        <SectionCard title={`Cara a cara (${preview.h2h.h2hGames.length})`}>
          <MatchGrid games={preview.h2h.h2hGames} onSelect={goGame} dateOrder="desc" hideHeaderLink />
        </SectionCard>
      )}

      {preview.trends.length > 0 && (
        <SectionCard title="Tendencias destacadas">
          <div className="space-y-2">
            {preview.trends.map((t, i) => (
              <BetTrendRow key={`${t.lineTypeId}-${i}`} trend={t} />
            ))}
          </div>
        </SectionCard>
      )}

      <MatchPredictions predictions={preview.predictions} />

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/partido/${preview.gameId}`)}
          className="font-body bg-bg-card border-border-card text-text-muted hover:text-accent-gold hover:border-border-hover focus-visible rounded-xl border px-6 py-2.5 text-sm font-medium transition-all duration-200"
        >
          Ver ficha del partido →
        </button>
        <ShareButton title={`${homeName} vs ${awayName} (previa) · ScoreHub`} />
      </div>
    </div>
  )
}
