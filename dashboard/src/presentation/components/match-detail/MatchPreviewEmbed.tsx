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
 * Fila comparativa: valor local a la izquierda (azul), etiqueta al centro,
 * valor visita a la derecha (dorado), con barra dual proporcional debajo.
 * Si `invert` (ej. posición: menor es mejor), la barra larga la lleva el
 * valor más bajo.
 */
function CompareRow({
  label,
  home,
  away,
  invert = false,
}: {
  label: string
  home: number | null
  away: number | null
  invert?: boolean
}) {
  const hv = home ?? 0
  const av = away ?? 0
  const total = hv + av
  // Proporción de la barra: con invert se usa (max - valor) para que el
  // mejor (más bajo) tenga la barra más larga.
  const score = (v: number) => (invert ? Math.max(hv, av, 1) - v + 1 : v)
  const hs = score(hv)
  const as = score(av)
  const hPct = total === 0 && !invert ? 50 : (hs / (hs + as || 1)) * 100
  const homeBetter = hv !== av && (invert ? hv < av : hv > av)
  const awayBetter = hv !== av && (invert ? av < hv : av > hv)
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className={`font-display text-2xl font-bold tabular-nums ${homeBetter ? 'text-accent-blue' : 'text-text-primary'}`}>
          {home ?? '–'}
        </span>
        <span className="font-body text-text-dim pb-1 text-[11px] tracking-wider uppercase">{label}</span>
        <span className={`font-display text-2xl font-bold tabular-nums ${awayBetter ? 'text-accent-gold' : 'text-text-primary'}`}>
          {away ?? '–'}
        </span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
        <div className="bg-accent-blue h-full" style={{ width: `${hPct}%` }} />
        <div className="bg-accent-gold h-full flex-1" />
      </div>
    </div>
  )
}

/**
 * Previa compacta embebida en la ficha del partido: forma reciente de ambos
 * equipos + comparativa de tabla + acceso a la previa completa. No renderiza
 * nada si el bundle de previa no trae datos.
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
  const hasRecord =
    home != null &&
    away != null &&
    (home.won != null || home.drawn != null || home.lost != null) &&
    (away.won != null || away.drawn != null || away.lost != null)
  // Cada fila G/E/P solo si algún lado tiene > 0 (evita ruido "0G · 0E · 0P").
  const showRow = (h: number | null | undefined, a: number | null | undefined) =>
    (h ?? 0) > 0 || (a ?? 0) > 0

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
          <div className="bg-bg-elevated/30 rounded-xl px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-body text-text-primary truncate text-sm font-semibold">{homeName}</span>
              <span className="font-display text-text-dim text-sm font-bold">VS</span>
              <span className="font-body text-text-primary truncate text-right text-sm font-semibold">{awayName}</span>
            </div>
            <div className="space-y-3">
              <CompareRow label="Posición" home={home?.position ?? null} away={away?.position ?? null} invert />
              <CompareRow label="Puntos" home={home?.points ?? null} away={away?.points ?? null} />
              <CompareRow label="Partidos" home={home?.played ?? null} away={away?.played ?? null} />
              {hasRecord && showRow(home?.won, away?.won) && (
                <CompareRow label="Victorias" home={home?.won ?? null} away={away?.won ?? null} />
              )}
              {hasRecord && showRow(home?.drawn, away?.drawn) && (
                <CompareRow label="Empates" home={home?.drawn ?? null} away={away?.drawn ?? null} />
              )}
              {hasRecord && showRow(home?.lost, away?.lost) && (
                <CompareRow label="Derrotas" home={home?.lost ?? null} away={away?.lost ?? null} />
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
