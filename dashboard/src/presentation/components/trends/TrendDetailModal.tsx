import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Trend } from '@/domain/entities/BettingTip'
import { useTrendDetails } from '@/presentation/hooks/useTransfersAndMore'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { useFocusTrap } from '@/presentation/hooks/useFocusTrap'

interface Props {
  trend: Trend | null
  onClose: () => void
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch {
    return ''
  }
}

export function TrendDetailModal({ trend, onClose }: Props) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, !!trend)
  const { detail: details, loading } = useTrendDetails(trend?.id ?? null)

  useEffect(() => {
    if (!trend) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [trend, onClose])

  if (!trend) return null

  const evidence = details?.games ?? []
  const avgOutcome =
    evidence.length > 0
      ? (evidence.reduce((s, g) => s + (g.outcome ?? 0), 0) / evidence.length).toFixed(1)
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de tendencia"
        className="bg-bg-card border-border-card animate-fade-in-up max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-xl border"
      >
        <div className="border-border-card/50 flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex-1">
            <p className="font-body text-accent-gold text-[10px] font-semibold tracking-wider uppercase">
              Tendencia #{trend.id}
            </p>
            <h2 className="font-display text-text-primary mt-1 text-lg font-bold leading-tight">
              {trend.text || trend.betCTA || 'Tendencia'}
            </h2>
            {trend.betCTA && trend.betCTA !== trend.text && (
              <p className="font-body text-text-muted mt-1 text-sm">{trend.betCTA}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="hover:bg-bg-elevated text-text-muted hover:text-text-primary focus-visible -mr-2 rounded-lg p-2.5 transition-colors"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Stats resumen */}
          <div className="bg-bg-elevated/30 flex items-center gap-4 rounded-lg p-3">
            <div>
              <p className="font-body text-text-dim text-[10px] tracking-wider uppercase">
                Confianza
              </p>
              <p className="font-display text-accent-gold text-2xl font-bold">
                {((trend.percentage ?? 0) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-border-card h-10 w-px" />
            <div>
              <p className="font-body text-text-dim text-[10px] tracking-wider uppercase">
                Muestra
              </p>
              <p className="font-display text-text-primary text-2xl font-bold">
                {evidence.length > 0 ? evidence.length : '—'}
              </p>
              <p className="font-body text-text-muted text-[10px]">
                {evidence.length > 0 ? 'partidos analizados' : 'cargando…'}
              </p>
            </div>
            {avgOutcome !== null && (
              <>
                <div className="bg-border-card h-10 w-px" />
                <div>
                  <p className="font-body text-text-dim text-[10px] tracking-wider uppercase">
                    Outcome prom.
                  </p>
                  <p className="font-display text-text-primary text-2xl font-bold">{avgOutcome}</p>
                </div>
              </>
            )}
          </div>

          {/* Causa */}
          {trend.cause && (
            <div>
              <p className="font-body text-text-dim text-[10px] tracking-wider uppercase">Causa</p>
              <p className="font-body text-text-primary mt-1 text-sm">{trend.cause}</p>
            </div>
          )}

          {/* Juegos de soporte */}
          <div>
            <p className="font-body text-text-dim mb-2 text-[10px] tracking-wider uppercase">
              Partidos que soportan esta tendencia
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-bg-elevated skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : evidence.length === 0 ? (
              <p className="font-body text-text-muted text-xs">Sin evidencia disponible</p>
            ) : (
              <ul className="space-y-1.5">
                {evidence.map(g => (
                  <li
                    key={g.game.id}
                    className="bg-bg-elevated/30 flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        navigate(`/partido/${g.game.id}`)
                      }}
                      className="font-body text-text-primary hover:text-accent-gold flex flex-1 items-center gap-2 text-left text-xs transition-colors"
                    >
                      <span className="text-text-dim font-mono">
                        {formatDate(g.game.startTime)}
                      </span>
                      <TeamBadge
                        src={g.game.homeCompetitor?.badgeUrl ?? null}
                        name={g.game.homeCompetitor?.name || '?'}
                        size="sm"
                      />
                      <span className="font-body max-w-[80px] truncate">
                        {g.game.homeCompetitor?.name}
                      </span>
                      <span className="text-text-dim font-mono text-[10px]">
                        {g.game.homeCompetitor?.score ?? 0}-
                        {g.game.awayCompetitor?.score ?? 0}
                      </span>
                      <span className="font-body max-w-[80px] truncate">
                        {g.game.awayCompetitor?.name}
                      </span>
                      <TeamBadge
                        src={g.game.awayCompetitor?.badgeUrl ?? null}
                        name={g.game.awayCompetitor?.name || '?'}
                        size="sm"
                      />
                    </button>
                    <span
                      className={`font-body shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        g.outcome === 1 || g.outcome === 2
                          ? 'bg-accent-green/15 text-accent-green'
                          : g.outcome === 3
                            ? 'bg-bg-elevated text-text-muted'
                            : 'bg-bg-elevated text-text-dim'
                      }`}
                      title={outcomeTitle(g.outcome)}
                    >
                      {outcomeLabel(g.outcome)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function outcomeLabel(outcome: number | undefined | null): string {
  if (outcome === 1) return 'Local'
  if (outcome === 2) return 'Visit.'
  if (outcome === 3) return 'Empate'
  return '—'
}

function outcomeTitle(outcome: number | undefined | null): string {
  if (outcome === 1) return 'Ganó el local'
  if (outcome === 2) return 'Ganó el visitante'
  if (outcome === 3) return 'Empate'
  return 'Sin resultado'
}
