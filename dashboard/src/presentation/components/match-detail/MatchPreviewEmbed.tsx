import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchPreview } from '@/presentation/hooks/useMatchPreview'
import { FormBadges, SectionCard } from './PreviewShared'

interface MatchPreviewEmbedProps {
  gameId: number
  homeTeamId: number
  awayTeamId: number
  homeName: string
  awayName: string
}

/**
 * Previa compacta embebida en la ficha del partido: forma reciente de ambos
 * equipos + mini-tabla + acceso a la previa completa. No renderiza nada si
 * el bundle de previa no trae datos.
 */
export const MatchPreviewEmbed = memo(function MatchPreviewEmbed({
  gameId,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
}: MatchPreviewEmbedProps) {
  const navigate = useNavigate()
  const { preview, loading } = useMatchPreview(gameId)

  if (loading) {
    return <div className="bg-bg-card skeleton h-48 rounded-xl" aria-hidden="true" />
  }
  if (!preview) return null

  const hasForm = preview.form.home.length > 0 || preview.form.away.length > 0
  const { home, away } = preview.table
  const hasTable = home != null || away != null
  if (!hasForm && !hasTable) return null
  const record = (t: typeof home) =>
    t != null && (t.won != null || t.drawn != null || t.lost != null)
      ? `${t.won ?? '–'}G · ${t.drawn ?? '–'}E · ${t.lost ?? '–'}P`
      : null
  const homeRecord = record(home)
  const awayRecord = record(away)

  return (
    <SectionCard title="Previa · forma y tabla">
      <div className="space-y-5">
        {hasForm && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="font-body text-text-primary mb-2 text-sm font-semibold">{homeName}</p>
              <FormBadges teamId={homeTeamId} entries={preview.form.home} />
            </div>
            <div>
              <p className="font-body text-text-primary mb-2 text-sm font-semibold">{awayName}</p>
              <FormBadges teamId={awayTeamId} entries={preview.form.away} />
            </div>
          </div>
        )}
        {hasTable && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono text-text-primary text-2xl font-bold">{home?.position ?? '–'}</p>
              <p className="font-body text-text-dim truncate text-[11px] uppercase">{homeName}</p>
              <p className="font-body text-text-muted text-[11px]">
                {home?.points ?? '–'} pts · {home?.played ?? '–'} PJ
              </p>
              {homeRecord && (
                <p className="font-body text-text-dim mt-0.5 text-[11px]">{homeRecord}</p>
              )}
            </div>
            <div className="flex items-center justify-center">
              <span className="font-body text-text-dim text-xs">POS · PTS · PJ</span>
            </div>
            <div>
              <p className="font-mono text-text-primary text-2xl font-bold">{away?.position ?? '–'}</p>
              <p className="font-body text-text-dim truncate text-[11px] uppercase">{awayName}</p>
              <p className="font-body text-text-muted text-[11px]">
                {away?.points ?? '–'} pts · {away?.played ?? '–'} PJ
              </p>
              {awayRecord && (
                <p className="font-body text-text-dim mt-0.5 text-[11px]">{awayRecord}</p>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate(`/partido/${gameId}/previa`)}
            className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible rounded px-1 py-0.5 text-xs transition-colors"
          >
            Ver previa completa (H2H, tendencias) →
          </button>
        </div>
      </div>
    </SectionCard>
  )
})
