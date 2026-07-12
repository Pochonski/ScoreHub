import { useState, useEffect, useRef } from 'react'
import { useHistoryDetail } from '@/presentation/hooks/useHistoryDetail'
import { useFocusTrap } from '@/presentation/hooks/useFocusTrap'

interface Props {
  seasonNum: number
  onClose: () => void
}

function AccordionSection({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-bg-elevated/20 focus-visible flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="font-body text-text-dim text-[10px] tracking-wider uppercase">{title}</span>
        <span
          className={`text-text-dim shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5l4 4 4-4" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-border-card/50 border-t px-4 pt-3 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

function useEscapeClose(isActive: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isActive) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isActive, onClose])
}

export function HistoricalMatchStatsModal({ seasonNum, onClose }: Props) {
  const { edition, matchStats, lineups, loading } = useHistoryDetail(seasonNum)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)
  useEscapeClose(true, onClose)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Estadísticas históricas del partido"
        className="bg-bg-card border-border-card animate-fade-in-up max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border"
      >
        {/* Header */}
        <div className="border-border-card/50 flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-display text-text-primary text-lg font-bold">
              {edition?.year ? `${edition.year} — ${edition.title || ''}` : 'Cargando...'}
            </h2>
            {matchStats && (
              <p className="text-accent-gold mt-0.5 font-mono text-sm font-bold">
                {matchStats.homeTeam} {matchStats.homeScore} — {matchStats.awayScore} {matchStats.awayTeam}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="hover:bg-bg-elevated text-text-muted hover:text-text-primary focus-visible rounded-lg p-1.5 transition-colors"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {loading && (
            <div className="space-y-3">
              <div className="bg-bg-elevated skeleton h-4 w-32 rounded" />
              <div className="bg-bg-elevated skeleton h-40 rounded-lg" />
            </div>
          )}

          {/* Match stats */}
          {matchStats && (
            <AccordionSection title="Estadísticas del Partido" defaultOpen>
              <div className="border-border-card overflow-hidden rounded-lg border">
                <div className="bg-border-card font-body grid grid-cols-3 gap-px text-xs">
                  {matchStats.stats.map((stat, i) => (
                    <div key={i} className="contents">
                      <div className="bg-bg-card text-text-muted px-3 py-2 text-right">{stat.home}</div>
                      <div className="bg-bg-card text-text-dim px-3 py-2 text-center font-medium">
                        {stat.name}
                      </div>
                      <div className="bg-bg-card text-text-muted px-3 py-2">{stat.away}</div>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionSection>
          )}

          {/* Lineups */}
          {lineups && (
            <AccordionSection title="Alineaciones" defaultOpen>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  {
                    team: lineups.homeTeam,
                    formation: lineups.homeFormation,
                    players: lineups.homeStarting,
                    coach: lineups.homeCoach,
                  },
                  {
                    team: lineups.awayTeam,
                    formation: lineups.awayFormation,
                    players: lineups.awayStarting,
                    coach: lineups.awayCoach,
                  },
                ].map((side) => (
                  <div key={side.team} className="bg-bg-elevated/30 rounded-lg p-3">
                    <p className="font-body text-text-primary mb-1 text-xs font-semibold">
                      {side.team}
                      {side.formation && (
                        <span className="text-text-dim ml-1 font-normal">({side.formation})</span>
                      )}
                    </p>
                    <ul className="space-y-0.5">
                      {side.players.map((p, i) => (
                        <li key={i} className="font-body text-text-muted flex items-center gap-1.5 text-xs">
                          {p.shirtNumber != null && (
                            <span className="text-text-dim w-4 text-right font-mono text-[10px]">
                              {p.shirtNumber}
                            </span>
                          )}
                          <span className="truncate">{p.name}</span>
                          {p.isCaptain && <span className="text-accent-gold text-[10px]">(C)</span>}
                        </li>
                      ))}
                    </ul>
                    {side.coach && (
                      <p className="font-body text-text-dim border-border-card/30 mt-2 border-t pt-2 text-[10px]">
                        Entrenador: {side.coach}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}
        </div>
      </div>
    </div>
  )
}
