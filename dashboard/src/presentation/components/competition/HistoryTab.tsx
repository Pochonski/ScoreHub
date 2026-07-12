import { useState } from 'react'
import { useHistory } from '@/presentation/hooks/useHistory'
import type { HistoryEdition } from '@/domain/entities/HistoryEdition'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { HistoryStatsBanner } from './HistoryStatsBanner'
import { HistoricalMatchStatsModal } from './HistoricalMatchStatsModal'

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

function AccordionCard({ edition, isBackToBack }: { edition: HistoryEdition; isBackToBack: boolean }) {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const hasDetails = edition.venue || edition.host || edition.startTime || edition.matchId

  const scoreText =
    edition.homeScore != null && edition.awayScore != null
      ? edition.homePenaltyScore != null
        ? `${edition.homeScore}-${edition.awayScore}(${edition.homePenaltyScore})`
        : `${edition.homeScore}-${edition.awayScore}`
      : null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-bg-elevated/30 focus-visible flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="font-display text-accent-gold min-w-[3.5ch] text-lg font-bold">{edition.year}</span>

        {edition.champion ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="ring-accent-gold/30 shrink-0 rounded-full ring-2">
              <TeamBadge src={edition.champion.badgeUrl} name={edition.champion.name} size="sm" />
            </div>
            <span className="font-body text-accent-gold max-w-[72px] shrink-0 truncate text-xs font-semibold">
              {edition.champion.name}
            </span>
            {scoreText && (
              <span className="text-text-primary flex shrink-0 items-center gap-0.5 font-mono text-[11px] font-bold">
                {scoreText}
                {edition.penalties && (
                  <span className="text-[10px]" title="Definido por penales">
                    ⚽
                  </span>
                )}
              </span>
            )}
            {edition.runnerUp && (
              <>
                <div className="shrink-0 rounded-full">
                  <TeamBadge src={edition.runnerUp.badgeUrl} name={edition.runnerUp.name} size="sm" />
                </div>
                <span className="font-body text-text-muted max-w-[72px] shrink-0 truncate text-xs">
                  {edition.runnerUp.name}
                </span>
              </>
            )}
            {isBackToBack && (
              <span className="font-body text-accent-blue bg-accent-blue/10 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold">
                Bicampeón
              </span>
            )}
          </div>
        ) : null}

        {hasDetails && (
          <span
            className={`text-text-dim ml-auto shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l4 4 4-4" />
            </svg>
          </span>
        )}
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open && hasDetails ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-border-card/50 space-y-3 border-t px-4 pt-3 pb-4">
            {edition.venue && (
              <div>
                <p className="font-body text-text-dim mb-1 text-[10px] tracking-wider uppercase">Sede</p>
                <p className="font-body text-text-primary text-sm">{edition.venue}</p>
              </div>
            )}
            {edition.host && (
              <div>
                <p className="font-body text-text-dim mb-1 text-[10px] tracking-wider uppercase">País</p>
                <p className="font-body text-text-primary text-sm">{edition.host}</p>
              </div>
            )}
            {edition.startTime && (
              <div>
                <p className="font-body text-text-dim mb-1 text-[10px] tracking-wider uppercase">Partido</p>
                <p className="font-body text-text-primary text-sm">
                  {edition.champion?.name} {edition.homeScore ?? ''}—{edition.awayScore ?? ''}{' '}
                  {edition.runnerUp?.name}
                  {edition.homePenaltyScore != null &&
                    ` (${edition.homePenaltyScore}-${edition.awayPenaltyScore} pen.)`}
                  {edition.startTime && ` · ${formatDate(edition.startTime)}`}
                </p>
              </div>
            )}
            {edition.extraTime && <p className="font-body text-text-muted text-xs">Prórroga: Sí</p>}

            {edition.matchId && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-bg-elevated/40 text-text-muted font-body hover:bg-bg-elevated/60 focus-visible rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
              >
                Ver alineaciones
              </button>
            )}
          </div>
        </div>
      </div>

      {showModal && edition.matchId && (
        <HistoricalMatchStatsModal seasonNum={edition.seasonNum} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

export function HistoryTab() {
  const { history, loading } = useHistory()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card skeleton h-8 w-36 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-card skeleton rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="bg-bg-elevated h-6 w-10 rounded" />
                <div className="bg-bg-elevated h-8 w-8 rounded-full" />
                <div className="bg-bg-elevated h-4 w-12 rounded" />
                <div className="bg-bg-elevated h-8 w-8 rounded-full" />
                <div className="bg-bg-elevated h-4 flex-1 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">Historial no disponible</p>
      </div>
    )
  }

  const editions = [...history].sort((a, b) => b.year - a.year)

  const backToBack = new Set<number>()
  for (let i = 0; i < editions.length - 1; i++) {
    const cur = editions[i].champion?.name
    const next = editions[i + 1]?.champion?.name
    if (cur && cur === next) {
      backToBack.add(editions[i].seasonNum)
    }
  }

  return (
    <div className="space-y-6">
      <HistoryStatsBanner />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {editions.map((edition) => (
          <AccordionCard
            key={edition.seasonNum}
            edition={edition}
            isBackToBack={backToBack.has(edition.seasonNum)}
          />
        ))}
      </div>
    </div>
  )
}
