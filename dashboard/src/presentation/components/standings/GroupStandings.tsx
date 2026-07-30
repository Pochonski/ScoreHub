import { useNavigate } from 'react-router-dom'
import type { StandingGroup } from '@/domain/entities/Standing'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { FormDot } from '@/presentation/components/ui/FormDot'

interface GroupStandingsProps {
  groups: StandingGroup[]
  hideHeader?: boolean
}

function formatMatchTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export function GroupStandings({ groups, hideHeader }: GroupStandingsProps) {
  const navigate = useNavigate()

  if (groups.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="text-text-muted font-body text-sm">Tabla de posiciones no disponible</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.name} className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
          {!hideHeader && (
            <div className="border-border-card border-b px-4 py-3">
              <h3 className="font-display text-text-primary text-lg font-semibold">
                {group.displayName || group.name}
              </h3>
              {group.isCurrentStage === false && (
                <p className="font-body text-text-dim mt-0.5 text-[11px] uppercase tracking-wider">
                  Etapa no actual
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-border-card border-b">
                  <th className="text-text-dim font-body px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase">
                    #
                  </th>
                  <th className="text-text-dim font-body px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase">
                    Equipo
                  </th>
                  <th className="text-text-dim font-body px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase">
                    PJ
                  </th>
                  <th className="text-text-dim font-body hidden px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase sm:table-cell">
                    G
                  </th>
                  <th className="text-text-dim font-body hidden px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase sm:table-cell">
                    E
                  </th>
                  <th className="text-text-dim font-body hidden px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase sm:table-cell">
                    P
                  </th>
                  <th className="text-text-dim font-body hidden px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase md:table-cell">
                    GF
                  </th>
                  <th className="text-text-dim font-body hidden px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase md:table-cell">
                    GC
                  </th>
                  <th className="text-text-dim font-body hidden px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase md:table-cell">
                    DG
                  </th>
                  <th className="text-text-dim font-body px-3 py-2 text-center text-[11px] font-medium tracking-wider uppercase">
                    PTS
                  </th>
                  <th className="text-text-dim font-body hidden px-3 py-2 text-center text-[11px] font-medium tracking-wider uppercase sm:table-cell">
                    Forma
                  </th>
                  <th className="text-text-dim font-body hidden px-3 py-2 text-center text-[11px] font-medium tracking-wider uppercase lg:table-cell">
                    Próx.
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr
                    key={row.position}
                    onClick={() => navigate(`/equipo/${row.team.id}`)}
                    className={`border-border-card/50 hover:bg-bg-elevated/40 cursor-pointer border-b transition-colors ${
                      row.position === 1 ? 'bg-accent-gold/[0.05]' : ''
                    }`}
                  >
                    <td
                      className={`px-3 py-2.5 font-mono text-xs border-l-[3px] ${
                        row.position === 1
                          ? 'border-l-accent-gold'
                          : row.position <= 3
                            ? 'border-l-accent-gold/30'
                            : 'border-l-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className={
                            row.position === 1 ? 'text-accent-gold font-bold' : 'text-text-muted'
                          }
                        >
                          {row.position}
                        </span>
                        {row.trend != null && row.trend !== 0 && (
                          <span
                            className={`font-mono text-[10px] ${
                              row.trend > 0 ? 'text-accent-green' : 'text-accent-red'
                            }`}
                            title={`${row.trend > 0 ? '↑' : '↓'} ${Math.abs(row.trend)}`}
                          >
                            {row.trend > 0 ? '↑' : '↓'}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <TeamBadge src={row.team.badgeUrl ?? null} name={row.team.name} size="sm" />
                        <span className="font-body text-text-primary max-w-[120px] truncate text-sm font-medium sm:max-w-none">
                          {row.team.name}
                          {row.hasPointsDeduction && (
                            <span
                              className="font-body ml-1 text-[10px] text-accent-red"
                              title="Deducción de puntos"
                            >
                              *
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="text-text-primary px-2 py-2.5 text-center font-mono text-sm">
                      {row.played ?? 0}
                    </td>
                    <td className="text-text-primary hidden px-2 py-2.5 text-center font-mono text-sm sm:table-cell">
                      {row.won ?? 0}
                    </td>
                    <td className="text-text-primary hidden px-2 py-2.5 text-center font-mono text-sm sm:table-cell">
                      {row.drawn ?? 0}
                    </td>
                    <td className="text-text-primary hidden px-2 py-2.5 text-center font-mono text-sm sm:table-cell">
                      {row.lost ?? 0}
                    </td>
                    <td className="text-text-primary hidden px-2 py-2.5 text-center font-mono text-sm md:table-cell">
                      {row.goalsFor ?? 0}
                    </td>
                    <td className="text-text-primary hidden px-2 py-2.5 text-center font-mono text-sm md:table-cell">
                      {row.goalsAgainst ?? 0}
                    </td>
                    <td
                      className={`hidden px-2 py-2.5 text-center font-mono text-sm md:table-cell ${
                        (row.goalDiff ?? 0) > 0
                          ? 'text-accent-live'
                          : (row.goalDiff ?? 0) < 0
                            ? 'text-accent-red'
                            : 'text-text-muted'
                      }`}
                    >
                      {(row.goalDiff ?? 0) > 0 ? '+' : ''}
                      {row.goalDiff ?? 0}
                    </td>
                    <td className="font-display text-accent-gold px-3 py-2.5 text-center text-lg font-bold">
                      {row.points ?? 0}
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {row.recentForm.map((result, i) => (
                          <FormDot key={i} result={result} />
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      {row.nextMatch ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            navigate(`/partido/${row.nextMatch!.id}`)
                          }}
                          className="font-body text-text-muted hover:text-accent-gold flex items-center gap-1.5 text-xs transition-colors"
                          title={`${row.nextMatch.isHome ? 'vs' : '@'} ${row.nextMatch.opponent?.name} · J${row.nextMatch.roundNum ?? '?'}`}
                        >
                          <span className="text-text-dim font-mono">
                            {row.nextMatch.isHome ? 'vs' : '@'}
                          </span>
                          <TeamBadge
                            src={row.nextMatch.opponent?.badgeUrl ?? null}
                            name={row.nextMatch.opponent?.name ?? '?'}
                            size="sm"
                          />
                          <span className="font-body text-text-primary max-w-[80px] truncate text-xs">
                            {row.nextMatch.opponent?.name}
                          </span>
                          <span className="text-text-dim font-mono text-[10px]">
                            {formatMatchTime(row.nextMatch.startTime)}
                          </span>
                        </button>
                      ) : (
                        <span className="font-body text-text-dim text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
