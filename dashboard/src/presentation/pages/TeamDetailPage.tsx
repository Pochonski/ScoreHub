import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTeamInfo, useTeamRecentForm, useTeamUpcoming, useCompetitionTransfers } from '@/presentation/hooks/useTransfersAndMore'
import { useCompetitions } from '@/presentation/hooks/useCompetitions'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { MatchCardSkeleton } from '@/presentation/components/ui/Skeleton'
import { ErrorState } from '@/presentation/components/ui/ErrorState'
import type { RawGame } from '@/domain/entities/RawGame'

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch {
    return ''
  }
}

function outcomeLabel(outcome: number | undefined, homeId: number, awayId: number, teamId: number): { label: string; color: string } | null {
  if (outcome == null) return null
  // outcome: 0 = pending?, 1 = home win, 2 = away win, 3 = draw
  if (outcome === 3) return { label: 'E', color: 'text-text-muted bg-bg-elevated' }
  const won = (outcome === 1 && homeId === teamId) || (outcome === 2 && awayId === teamId)
  const lost = (outcome === 1 && awayId === teamId) || (outcome === 2 && homeId === teamId)
  if (won) return { label: 'G', color: 'text-white bg-accent-green' }
  if (lost) return { label: 'P', color: 'text-white bg-accent-red' }
  return null
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const teamId = useMemo(() => (id ? parseInt(id, 10) : null), [id])
  const { info, loading: infoLoading } = useTeamInfo(teamId)
  const { games: recentForm } = useTeamRecentForm(teamId, 5)
  const { games: upcoming, loading: upcomingLoading } = useTeamUpcoming(teamId)
  const { transfers, loading: transfersLoading } = useCompetitionTransfers(
    info?.mainCompetitionId ?? null,
    teamId
  )
  const { competitions } = useCompetitions()
  // Resolver nombre de la competición principal del equipo (Fase 8.7+).
  // Antes estaba hardcoded para Mundial (5930) y Liga Promerica (5056).
  // Ahora se resuelve dinámicamente desde la lista de competitions.
  // Si competitions aún no está cargada, usar el ID como fallback.
  const mainCompName = useMemo(() => {
    if (!info?.mainCompetitionId) return 'competición'
    return competitions?.find(c => c.id === info.mainCompetitionId)?.displayName
      ?? `competición #${info.mainCompetitionId}`
  }, [info?.mainCompetitionId, competitions])

  if (infoLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
        <div className="flex items-center gap-4">
          <div className="bg-bg-elevated skeleton h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-bg-elevated skeleton h-7 w-56 rounded" />
            <div className="bg-bg-elevated skeleton h-4 w-32 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <ErrorState
          message="Equipo no encontrado"
          onAction={() => navigate('/competiciones')}
          actionLabel="Ver competiciones"
        />
      </div>
    )
  }

  // Stats rápidas: contar W/D/L en forma reciente.
  // Cálculo directo (no useMemo) — es barato y respeta Rules of Hooks
  // al no declararse después de un early return.
  let formW = 0, formD = 0, formL = 0
  for (const g of recentForm) {
    const homeId = g.homeCompetitor?.id
    const awayId = g.awayCompetitor?.id
    const oc = g.outcome
    if (oc === undefined) continue
    if (oc === 3) formD++
    else if ((oc === 1 && homeId === teamId) || (oc === 2 && awayId === teamId)) formW++
    else if ((oc === 1 && awayId === teamId) || (oc === 2 && homeId === teamId)) formL++
  }
  const formStats = { w: formW, d: formD, l: formL }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Hero */}
      <section className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
        <div
          className="h-20 w-full"
          style={{
            background: info.color
              ? `linear-gradient(135deg, ${info.color}55 0%, ${info.awayColor ?? '#ffffff'}22 100%)`
              : 'linear-gradient(135deg, #444 0%, #222 100%)',
          }}
        />
        <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
          <TeamBadge src={info.badgeUrl ?? null} name={info.name} size="lg" />
          <div className="flex-1">
            <h1 className="font-display text-text-primary text-3xl font-bold">{info.name}</h1>
            <div className="font-body text-text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {info.shortName && info.shortName !== info.name && (
                <span className="font-mono">{info.shortName}</span>
              )}
              {info.symbolicName && (
                <span className="text-text-dim font-mono text-[11px] uppercase tracking-wider">
                  {info.symbolicName}
                </span>
              )}
              {info.countryId && (
                <span>
                  <span className="text-text-dim">·</span> País #{info.countryId}
                </span>
              )}
              {info.popularityRank != null && (
                <span className="font-mono text-[10px]">
                  <span className="text-text-dim">·</span> rank {info.popularityRank}
                </span>
              )}
            </div>
          </div>

          {/* Forma reciente (W-D-L) */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="font-display text-text-primary text-lg font-bold">{formStats.w + formStats.d + formStats.l}</div>
              <div className="font-body text-text-dim text-[10px] uppercase tracking-wider">Últimos 5</div>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const g = recentForm[i]
                if (!g) {
                  return <span key={i} className="bg-bg-elevated h-6 w-6 rounded-full" />
                }
                const homeId = g.homeCompetitor?.id
                const awayId = g.awayCompetitor?.id
                const oc = g.outcome
                const oc_lbl = outcomeLabel(oc, homeId ?? 0, awayId ?? 0, teamId ?? 0)
                return (
                  <span
                    key={i}
                    title={`${g.homeCompetitor?.name} vs ${g.awayCompetitor?.name} · ${g.homeCompetitor?.score ?? 0}-${g.awayCompetitor?.score ?? 0}`}
                    className={`font-body flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      oc_lbl?.color ?? 'bg-bg-elevated text-text-dim'
                    }`}
                  >
                    {oc_lbl?.label ?? '·'}
                  </span>
                )
              })}
            </div>
            <div className="flex flex-col items-center font-mono text-[11px]">
              <div className="flex gap-1">
                <span className="text-accent-green font-bold">{formStats.w}</span>
                <span className="text-text-dim">G</span>
              </div>
              <div className="flex gap-1">
                <span className="text-text-muted font-bold">{formStats.d}</span>
                <span className="text-text-dim">E</span>
              </div>
              <div className="flex gap-1">
                <span className="text-accent-red font-bold">{formStats.l}</span>
                <span className="text-text-dim">P</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botón volver */}
        {info.mainCompetitionId && (
          <div className="border-border-card/50 border-t px-5 py-3">
            <button
              type="button"
              onClick={() => navigate(`/competicion/${info.mainCompetitionId}/standings`)}
              className="font-body text-text-muted hover:text-accent-gold text-xs transition-colors"
            >
              ← Ver en {mainCompName}
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Próximos partidos */}
        <section className="lg:col-span-2">
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">
            Próximos partidos
          </h2>
          {upcomingLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <MatchCardSkeleton key={i} />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="bg-bg-card border-border-card rounded-xl border p-6 text-center">
              <p className="font-body text-text-muted text-sm">Sin partidos próximos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 8).map(g => (
                <GameRow key={g.id} game={g} teamId={teamId!} onClick={() => navigate(`/partido/${g.id}`)} />
              ))}
            </div>
          )}
        </section>

        {/* Fichajes */}
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">
            Fichajes recientes
          </h2>
          {transfersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-bg-card border-border-card skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <div className="bg-bg-card border-border-card rounded-xl border p-6 text-center">
              <p className="font-body text-text-muted text-xs">Sin fichajes</p>
            </div>
          ) : (
            <ul className="bg-bg-card border-border-card divide-border-card/40 divide-y rounded-xl border">
              {transfers.slice(0, 12).map(t => {
                const isArrival = t.targetId === teamId
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-body shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          isArrival
                            ? 'bg-accent-green/15 text-accent-green'
                            : 'bg-accent-red/15 text-accent-red'
                        }`}
                      >
                        {isArrival ? 'In' : 'Out'}
                      </span>
                      <span className="font-body text-text-primary text-xs">
                        {t.athleteName || (t.data && typeof t.data === 'object' ? (t.data as Record<string, unknown>).athleteName as string : null) || `#${t.athleteId}`}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-text-dim">{formatDate(t.time ?? undefined)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function GameRow({ game, teamId, onClick }: { game: RawGame; teamId: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-bg-card border-border-card hover:bg-bg-elevated/30 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="font-body text-text-dim text-[10px] font-mono">{formatDate(game.startTime)}</span>
        <TeamBadge src={game.homeCompetitor?.badgeUrl ?? null} name={game.homeCompetitor?.name || '?'} size="sm" />
        <span className="font-body text-text-primary text-sm">{game.homeCompetitor?.name}</span>
        <span className="text-text-dim font-mono text-xs">vs</span>
        <span className="font-body text-text-primary text-sm">{game.awayCompetitor?.name}</span>
        <TeamBadge src={game.awayCompetitor?.badgeUrl ?? null} name={game.awayCompetitor?.name || '?'} size="sm" />
      </div>
      <span
        className={`font-body shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
          game.homeCompetitor?.id === teamId || game.awayCompetitor?.id === teamId
            ? 'bg-accent-gold/15 text-accent-gold'
            : 'bg-bg-elevated text-text-muted'
        }`}
      >
        {game.competitionDisplayName?.split('-').pop()?.trim() || game.statusText || 'Próximo'}
      </span>
    </button>
  )
}
