import { useNavigate } from 'react-router-dom'
import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
  AthleteLastMatch,
} from '@/domain/entities/Athlete'
import { formatShortDate } from '@/presentation/utils/dates'
import {
  formatDate,
  contractYear,
  buildTeamTimeline,
  parseCareerTables,
  isLoanTitle,
} from './playerProfileUtils'

interface PlayerProfileProps {
  athlete: Athlete
  career: AthleteCareerSeason[]
  trophies: AthleteTrophyCategory[]
  transfers: AthleteTransfer[]
  /** When true, supplement fetches (career/trophies/transfers) failed but
   *  the core profile loaded. We render a small banner so users know. */
  partialData?: boolean
}

function RatingBadge({ match }: { match: AthleteLastMatch }) {
  if (!match.rating) return null
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs font-bold text-white"
      style={{ backgroundColor: match.rating.bgColor || '#666' }}
      title="Puntaje del partido"
    >
      {match.rating.value}
    </span>
  )
}

export function PlayerProfile({ athlete, career, trophies, transfers, partialData }: PlayerProfileProps) {
  const navigate = useNavigate()
  const teamStints = buildTeamTimeline(transfers)

  const activeTransfer = transfers.find((t) => t.competitorName)
  const clubName = activeTransfer?.competitorName ?? null
  const latestTransfer = transfers[0]
  const onLoan = athlete.onLoanFrom != null || isLoanTitle(latestTransfer?.transferTitle)
  const highlightGroups = athlete.highlightStats ?? []
  const lastMatches = (athlete.lastMatches ?? []).slice(0, 5)

  return (
    <div className="space-y-6">
      {partialData && (
        <div
          role="status"
          className="bg-accent-gold/10 border-accent-gold/40 text-text-muted font-body rounded-lg border px-3 py-2 text-xs"
        >
          Algunos datos (palmarés, transferencias o carrera) no pudieron cargarse.
          El perfil base se muestra correctamente.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="relative shrink-0">
          <div className="bg-bg-elevated border-border-card h-24 w-24 overflow-hidden rounded-full border-2 sm:h-32 sm:w-32">
            {athlete.photoUrl ? (
              <img src={athlete.photoUrl} alt={athlete.name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-text-muted flex h-full w-full items-center justify-center text-3xl">
                {athlete.name.charAt(0)}
              </span>
            )}
          </div>
          {athlete.jerseyNum != null && (
            <span
              className="bg-accent-gold text-bg-base font-display absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow"
              title="Dorsal"
            >
              {athlete.jerseyNum}
            </span>
          )}
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="font-display text-text-primary text-2xl font-bold sm:text-3xl">{athlete.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            {athlete.position?.name && (
              <span className="font-body bg-accent-blue/10 text-accent-blue rounded-full px-2 py-0.5 text-xs">
                {athlete.position.name}
              </span>
            )}
            {clubName && athlete.clubId != null && (
              <button
                type="button"
                onClick={() => navigate(`/equipo/${athlete.clubId}`)}
                className="font-body bg-bg-elevated text-text-primary hover:text-accent-gold focus-visible rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
              >
                {clubName}
              </button>
            )}
            {athlete.nationalityName && (
              <span className="font-body bg-bg-elevated text-text-muted rounded-full px-2 py-0.5 text-xs">
                {athlete.nationalityName}
              </span>
            )}
            {onLoan && (
              <span
                className="font-body bg-accent-gold/15 text-accent-gold rounded-full px-2 py-0.5 text-xs font-medium"
                title={athlete.onLoanUntil ? `Cedido hasta ${athlete.onLoanUntil}` : 'Jugador cedido'}
              >
                Cedido
              </span>
            )}
            {athlete.age != null && (
              <span className="font-body text-text-muted text-xs">{athlete.age} años</span>
            )}
          </div>
          {athlete.nationalTeamStatsText && (
            <p className="font-body text-text-muted mt-1 text-sm">{athlete.nationalTeamStatsText}</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {athlete.shortBio && (
        <p className="font-body text-text-muted text-sm leading-relaxed">{athlete.shortBio}</p>
      )}

      {/* Ficha */}
      {athlete.playerDetails && athlete.playerDetails.length > 0 && (
        <section aria-label="Ficha del jugador">
          <div className="grid grid-cols-3 gap-2">
            {athlete.playerDetails.slice(0, 6).map((d, i) => (
              <div key={i} className="bg-bg-card border-border-card rounded-lg border px-3 py-2 text-center">
                <div className="font-body text-text-dim text-[11px] tracking-wide uppercase">{d.title}</div>
                <div className="font-body text-text-primary mt-0.5 truncate text-sm font-semibold" title={d.value}>
                  {d.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Destacados */}
      {highlightGroups.length > 0 && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Destacados</h2>
          <div className="space-y-3">
            {highlightGroups.map((g, gi) => (
              <div key={gi} className="bg-bg-card border-border-card rounded-xl border p-3">
                <h3 className="font-body text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                  {g.name}
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {g.stats.slice(0, 6).map((s, si) => (
                    <div
                      key={si}
                      className={`rounded-lg px-2 py-2 text-center ${
                        s.isTop ? 'bg-accent-gold/10 ring-accent-gold/30 ring-1' : 'bg-bg-elevated/50'
                      }`}
                    >
                      <div className={`font-display text-base font-bold tabular-nums ${s.isTop ? 'text-accent-gold' : 'text-text-primary'}`}>
                        {s.value}
                      </div>
                      <div className="font-body text-text-dim mt-0.5 truncate text-[11px]" title={s.name}>
                        {s.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Estadísticas por temporada */}
      {career.length > 0 && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Estadísticas</h2>
          <div className="space-y-3">
            {career.map((s) => {
              const blocks = parseCareerTables(s.stats)
              if (!blocks.length) return null
              return (
                <details
                  key={s.seasonKey}
                  open={s.seasonKey !== '-1'}
                  className="bg-bg-card border-border-card rounded-lg border"
                >
                  <summary className="font-body text-text-primary cursor-pointer list-none px-3 py-2 text-sm font-medium select-none">
                    {s.name}
                  </summary>
                  <div className="border-border-card/50 space-y-3 border-t px-3 py-2">
                    {blocks.map((b, bi) => (
                      <div key={bi}>
                        <div className="font-body text-text-dim mb-1 text-[11px] font-semibold tracking-wider uppercase">
                          {b.competition}
                        </div>
                        <div className="space-y-1">
                          {b.stats.map((r, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-body text-text-muted truncate">{r.label}</span>
                              <span className="text-text-primary font-mono tabular-nums">{r.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      )}

      {/* Últimos partidos */}
      {lastMatches.length > 0 && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Últimos partidos</h2>
          <div className="space-y-2">
            {lastMatches.map((m) => (
              <button
                key={m.gameId}
                type="button"
                onClick={() => navigate(`/partido/${m.gameId}`)}
                className="bg-bg-card border-border-card hover:border-border-hover focus-visible flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-body text-text-dim truncate text-[11px]">
                    {m.startTime ? formatShortDate(m.startTime) : ''}
                    {m.competitionName ? ` · ${m.competitionName}` : ''}
                  </div>
                  <div className="font-body text-text-primary mt-0.5 truncate text-sm">
                    {m.home.name} {m.home.score ?? '-'} - {m.away.score ?? '-'} {m.away.name}
                  </div>
                  {!m.played && (
                    <div className="font-body text-text-dim mt-0.5 truncate text-[11px]">
                      No jugó{m.didNotPlayReason ? ` · ${m.didNotPlayReason}` : ''}
                    </div>
                  )}
                </div>
                {m.played && m.minutes != null && (
                  <span className="text-text-dim shrink-0 font-mono text-[11px]">{m.minutes}&apos;</span>
                )}
                <RatingBadge match={m} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Trayectoria (timeline única: carrera + transferencias) */}
      {teamStints && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Trayectoria</h2>
          <div className="space-y-1">
            {teamStints.map((s, i) => {
              const year = contractYear(s.contractUntil)
              return (
                <div
                  key={i}
                  className="border-border-card/30 flex items-center gap-3 border-b py-2 last:border-0"
                >
                  {s.badge ? (
                    <img
                      src={s.badge}
                      alt=""
                      className="bg-bg-elevated h-5 w-5 shrink-0 rounded-full object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="bg-bg-elevated font-body text-text-dim flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-[10px]">
                      {s.team.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-body text-text-primary text-sm font-medium">{s.team}</span>
                    <span className="font-body text-text-dim/60 ml-2 text-[11px]">{s.label}</span>
                    {i === 0 && year && (
                      <span className="text-text-dim ml-2 font-mono text-[11px]">Hasta {year}</span>
                    )}
                  </div>
                  <span className="text-text-dim shrink-0 font-mono text-[11px]">
                    {formatDate(s.start)} — {s.endLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Trofeos */}
      <section>
        <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Trofeos</h2>
        {trophies.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {trophies.map((category, i) => (
              <div key={i} className="bg-bg-card border-border-card rounded-lg border p-3">
                <h3 className="font-body text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                  {category.name}
                </h3>
                <div className="space-y-1">
                  {category.trophies.map((trophy, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <span className="font-body text-text-primary text-sm">{trophy.name}</span>
                      <span className="font-display text-accent-gold text-base font-bold">×{trophy.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-body text-text-dim text-sm">Sin trofeos registrados.</p>
        )}
      </section>
    </div>
  )
}
