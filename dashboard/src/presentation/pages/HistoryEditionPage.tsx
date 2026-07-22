import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHistoryDetail } from '@/presentation/hooks/useHistoryDetail'
import { useHistory } from '@/presentation/hooks/useHistory'

function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
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
        className="hover:bg-bg-elevated/20 focus-visible flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
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
          <div className="border-border-card/50 border-t px-5 pt-4 pb-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function HistoryEditionPage() {
  const { seasonNum } = useParams<{ seasonNum: string }>()
  const navigate = useNavigate()
  const num = seasonNum ? parseInt(seasonNum, 10) : null
  // History se mantiene scoped al Mundial (primary comp) por ahora;
  // cuando se implemente navegación multi-comp histórica se añadirá.
  const { edition, matchStats, lineups, loading } = useHistoryDetail(num)
  const { history } = useHistory()

  const sorted = [...history].reverse()
  const currentIdx = num ? sorted.findIndex((e) => e.seasonNum === num) : -1
  const prev = currentIdx > 0 ? sorted[currentIdx - 1] : null
  const next = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null
  const championName = edition?.champion?.name || ''
  const runnerUpName = edition?.runnerUp?.name || ''

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="space-y-3">
          <div className="bg-bg-elevated skeleton mx-auto h-8 w-72 rounded" />
          <div className="bg-bg-elevated skeleton mx-auto h-4 w-48 rounded" />
        </div>
        <div className="bg-bg-card skeleton h-48 rounded-xl" />
        <div className="bg-bg-card skeleton h-64 rounded-xl" />
      </div>
    )
  }

  if (!edition) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-body text-text-muted mb-4 text-sm">Edición no encontrada</p>
        <button
          onClick={() => navigate('/competiciones')}
          className="bg-accent-gold/10 text-accent-gold font-body hover:bg-accent-gold/20 focus-visible rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Volver a competiciones
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <div className="via-accent-gold/40 h-px w-8 bg-gradient-to-r from-transparent to-transparent" />
          <span className="font-display text-text-primary text-4xl font-bold">{edition.year}</span>
          <div className="via-accent-gold/40 h-px w-8 bg-gradient-to-r from-transparent to-transparent" />
        </div>
        {championName && runnerUpName && (
          <p className="font-body text-text-muted text-base">
            {championName} vs {runnerUpName}
          </p>
        )}
        {edition.title && <p className="font-body text-text-dim mt-1 text-sm">{edition.title}</p>}
        {(edition.venue || edition.host) && (
          <p className="font-body text-text-muted mt-1 text-xs">
            {[edition.venue, edition.host].filter(Boolean).join(' · ')}
            {edition.startTime ? ` · ${formatDate(edition.startTime)}` : ''}
          </p>
        )}
      </div>

      {/* Match stats */}
      {matchStats && matchStats.stats.length > 0 && (
        <AccordionSection title="Estadísticas del Partido">
          <div className="border-border-card overflow-hidden rounded-lg border">
            <div className="bg-border-card font-body grid grid-cols-3 gap-px text-xs">
              {matchStats.stats.map((stat, i) => (
                <div key={i} className={`contents ${i % 2 === 0 ? 'bg-bg-elevated/20' : 'bg-bg-card'}`}>
                  <div className="text-text-muted px-3 py-2 text-right">{stat.home}</div>
                  <div className="text-text-dim px-3 py-2 text-center font-medium">{stat.name}</div>
                  <div className="text-text-muted px-3 py-2">{stat.away}</div>
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Lineups */}
      {lineups && (
        <AccordionSection title="Alineaciones">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
              <div key={side.team}>
                <p className="font-body text-text-primary mb-2 text-sm font-semibold">
                  {side.team}
                  {side.formation && (
                    <span className="text-text-dim ml-1.5 font-normal">({side.formation})</span>
                  )}
                </p>
                <ul className="space-y-1">
                  {side.players.map((p, i) => (
                    <li key={i} className="font-body text-text-muted flex items-center gap-2 text-xs">
                      {p.shirtNumber != null && (
                        <span className="text-text-dim w-5 shrink-0 text-right font-mono text-[10px]">
                          {p.shirtNumber}
                        </span>
                      )}
                      <span className="truncate">{p.name}</span>
                      {p.isCaptain && <span className="text-accent-gold shrink-0 text-[10px]">(C)</span>}
                    </li>
                  ))}
                </ul>
                {side.coach && (
                  <p className="font-body text-text-dim border-border-card/30 mt-3 border-t pt-3 text-[10px]">
                    Entrenador: {side.coach}
                  </p>
                )}
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Navigation */}
      <div className="border-border-card/30 flex items-center justify-between gap-4 border-t pt-4">
        {prev ? (
          <button
            onClick={() => navigate(`/historial/${prev.seasonNum}`)}
            className="hover:bg-bg-card text-text-muted hover:text-text-primary font-body focus-visible flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M9 3L5 7l4 4" />
            </svg>
            <span className="max-w-[120px] truncate">
              {prev.year} ({prev.champion?.name || ''} vs {prev.runnerUp?.name || ''})
            </span>
          </button>
        ) : (
          <div />
        )}
        {next ? (
          <button
            onClick={() => navigate(`/historial/${next.seasonNum}`)}
            className="hover:bg-bg-card text-text-muted hover:text-text-primary font-body focus-visible flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
          >
            <span className="max-w-[120px] truncate">
              {next.year} ({next.champion?.name || ''} vs {next.runnerUp?.name || ''})
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M5 3l4 4-4 4" />
            </svg>
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
