import { useState } from 'react'
import { useCompetitionTransfersSummary, useCompetitionTransfers } from '@/presentation/hooks/useTransfersAndMore'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'

interface Props {
  competitionId: number
}

type FilterMode = 'all' | 'arrivals' | 'departures'

export function TransfersTab({ competitionId }: Props) {
  const [mode, setMode] = useState<FilterMode>('all')
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)

  const { summary, loading: loadingSummary } = useCompetitionTransfersSummary(competitionId)
  const { transfers, loading: loadingTransfers } = useCompetitionTransfers(
    competitionId,
    selectedTeam
  )

  if (loadingSummary) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-card border-border-card skeleton h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  if (summary.length === 0) {
    return (
      <div className="bg-bg-card border-border-card rounded-xl border p-8 text-center">
        <p className="font-body text-text-muted text-sm">Sin fichajes registrados aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen por equipo — expandible */}
      <div className="bg-bg-card border-border-card rounded-xl border">
        <div className="border-border-card/50 border-b px-4 py-3">
          <h3 className="font-body text-text-primary text-sm font-semibold tracking-wide uppercase">
            Movimientos por equipo
          </h3>
          <p className="font-body text-text-muted mt-0.5 text-xs">
            Toca un equipo para ver sus fichajes
          </p>
        </div>
        <ul className="divide-border-card/40 divide-y">
          {summary.map(team => {
            const active = selectedTeam === team.teamId
            return (
              <li key={team.teamId}>
                <button
                  type="button"
                  onClick={() => setSelectedTeam(active ? null : team.teamId)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    active ? 'bg-accent-gold/5' : 'hover:bg-bg-elevated/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TeamBadge src={team.badgeUrl ?? null} name={team.name} size="sm" />
                    <span className="font-body text-text-primary text-sm font-medium">
                      {team.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-accent-green">
                      +{team.arrivals}
                    </span>
                    <span className="text-text-dim">·</span>
                    <span className="text-accent-red">
                      −{team.departures}
                    </span>
                  </div>
                </button>

                {/* Expandible: detalle del equipo */}
                {active && (
                  <div className="bg-bg-elevated/10 border-border-card/30 border-t">
                    {/* Filtros */}
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                      <FilterButton
                        label="Todos"
                        active={mode === 'all'}
                        onClick={() => setMode('all')}
                      />
                      <FilterButton
                        label="Llegadas"
                        active={mode === 'arrivals'}
                        onClick={() => setMode('arrivals')}
                      />
                      <FilterButton
                        label="Salidas"
                        active={mode === 'departures'}
                        onClick={() => setMode('departures')}
                      />
                    </div>

                    {loadingTransfers ? (
                      <div className="space-y-2 px-4 pb-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="bg-bg-elevated skeleton h-12 rounded-lg" />
                        ))}
                      </div>
                    ) : transfers.length === 0 ? (
                      <div className="px-4 pb-4 pt-1 text-center">
                        <p className="font-body text-text-muted text-xs">Sin fichajes para este filtro</p>
                      </div>
                    ) : (
                      <ul className="divide-border-card/40 divide-y">
                        {transfers
                          .filter(t => {
                            if (mode === 'arrivals') return t.targetId === selectedTeam
                            if (mode === 'departures') return t.originId === selectedTeam
                            return true
                          })
                          .map(t => {
                            const isArrival = t.targetId === selectedTeam
                            return (
                              <li
                                key={t.id}
                                className="border-border-card/20 flex items-center justify-between gap-3 border-l-2 px-5 py-2.5"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`font-body shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                      isArrival
                                        ? 'bg-accent-green/15 text-accent-green'
                                        : 'bg-accent-red/15 text-accent-red'
                                    }`}
                                  >
                                    {isArrival ? 'In' : 'Out'}
                                  </span>
                                  <div>
                                    <p className="font-body text-text-primary text-sm font-medium">
                                      {t.athleteName || (t.data && typeof t.data === 'object' ? (t.data as Record<string, unknown>).athleteName as string : null) || `Atleta #${t.athleteId}`}
                                    </p>
                                    <p className="font-body text-text-muted mt-0.5 text-[11px]">
                                      {isArrival ? 'Desde' : 'Hacia'}{' '}
                                      <span className="text-text-dim">
                                        {isArrival
                                          ? (t.originName || `#${t.originId}`)
                                          : (t.targetName || `#${t.targetId}`)}
                                      </span>
                                      {t.price && (
                                        <>
                                          {' '}
                                          · <span className="text-accent-gold">{t.price}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-text-dim font-mono text-[10px]">
                                  {t.time ? new Date(t.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''}
                                </div>
                              </li>
                            )
                          })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}

          {summary.length === 0 && (
            <li className="px-4 py-6 text-center">
              <p className="font-body text-text-muted text-xs">Sin fichajes</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-body focus-visible rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
        active
          ? 'bg-accent-gold/15 text-accent-gold'
          : 'bg-bg-elevated/40 text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
