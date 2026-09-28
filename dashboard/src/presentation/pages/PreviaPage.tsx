import { useParams, useNavigate } from 'react-router-dom'
import { useMatchPreview, type PreviewFormEntry } from '@/presentation/hooks/useMatchPreview'
import { MatchHeader } from '@/presentation/components/match-detail/MatchHeader'
import { MatchGrid } from '@/presentation/components/matches/MatchGrid'
import { MatchPredictions } from '@/presentation/components/match-detail/MatchPredictions'
import { BetTrendRow } from '@/presentation/components/trends/BetTrendRow'
import { ErrorState } from '@/presentation/components/ui/ErrorState'
import type { Game } from '@/domain/entities/Game'

function resultClasses(result: 'W' | 'D' | 'L') {
  return result === 'W'
    ? 'bg-accent-live/15 text-accent-live'
    : result === 'D'
      ? 'bg-text-dim/15 text-text-muted'
      : 'bg-accent-red/15 text-accent-red'
}

function FormBadges({ teamId, entries }: { teamId: number; entries: PreviewFormEntry[] }) {
  if (entries.length === 0) {
    return <p className="font-body text-text-dim text-xs">Sin partidos recientes registrados</p>
  }
  const wins = entries.filter((e) => e.result === 'W').length
  const draws = entries.filter((e) => e.result === 'D').length
  const losses = entries.filter((e) => e.result === 'L').length
  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-text-dim text-[11px] tracking-wide uppercase">
        Últimos {entries.length}: {wins}V · {draws}E · {losses}D
      </p>
      <ul className="space-y-2">
        {entries.map((e) => {
          const isHome = e.game.homeTeam.id === teamId
          const opponent = isHome ? e.game.awayTeam.name : e.game.homeTeam.name
          return (
            <li key={e.gameId} className="flex items-center gap-2.5">
              <span
                className={`font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${resultClasses(e.result)}`}
              >
                {e.result}
              </span>
              <span className="font-mono text-text-primary text-sm font-bold">
                {e.scoreFor}-{e.scoreAgainst}
              </span>
              <span className="font-body text-text-muted min-w-0 flex-1 truncate text-xs">
                vs {opponent} · {isHome ? 'Casa' : 'Fuera'}
              </span>
              <span className="font-body text-text-dim shrink-0 text-[11px]">
                {e.startTime
                  ? new Date(e.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                  : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[11px] sm:text-[10px] tracking-wider uppercase">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

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

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => navigate(`/partido/${preview.gameId}`)}
          className="font-body bg-bg-card border-border-card text-text-muted hover:text-accent-gold hover:border-border-hover focus-visible rounded-xl border px-6 py-2.5 text-sm font-medium transition-all duration-200"
        >
          Ver ficha del partido →
        </button>
      </div>
    </div>
  )
}
