import type {
  Athlete,
  AthleteCareerSeason,
  AthleteTrophyCategory,
  AthleteTransfer,
} from '@/domain/entities/Athlete'

interface PlayerProfileProps {
  athlete: Athlete
  career: AthleteCareerSeason[]
  trophies: AthleteTrophyCategory[]
  transfers: AthleteTransfer[]
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })
  } catch {
    return d
  }
}

function buildTeamTimeline(transfers: AthleteTransfer[]) {
  const named = transfers.filter((t) => t.competitorName)
  if (!named.length) return null
  const chrono = [...named].reverse()
  const stints: { team: string; badge?: string | null; label: string; start: string; endLabel: string }[] = []
  let prev: AthleteTransfer | null = null
  for (const t of chrono) {
    if (!prev || prev.competitorName !== t.competitorName) {
      if (prev) stints[stints.length - 1].endLabel = formatDate(t.date)
      const label = t.transferTitle || (stints.length === 0 ? 'Cantera' : 'Traspaso')
      stints.push({
        team: t.competitorName!,
        badge: t.competitorBadge,
        label,
        start: t.date,
        endLabel: 'Presente',
      })
    }
    prev = t
  }
  return stints
}

export function PlayerProfile({ athlete, career, trophies, transfers }: PlayerProfileProps) {
  const teamStints = buildTeamTimeline(transfers)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="bg-bg-elevated border-border-card h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 sm:h-32 sm:w-32">
          {athlete.photoUrl ? (
            <img src={athlete.photoUrl} alt={athlete.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-text-muted flex h-full w-full items-center justify-center text-3xl">
              {athlete.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="font-display text-text-primary text-2xl font-bold sm:text-3xl">{athlete.name}</h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {athlete.position?.name && (
              <span className="font-body bg-accent-blue/10 text-accent-blue rounded-full px-2 py-0.5 text-xs">
                {athlete.position.name}
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

      {/* Carrera (timeline por equipos) */}
      {teamStints && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Carrera</h2>
          <div className="space-y-1">
            {teamStints.map((s, i) => (
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
                  <span className="bg-bg-elevated font-body text-text-dim flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]">
                    {s.team.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-body text-text-primary text-sm font-medium">{s.team}</span>
                  <span className="font-body text-text-dim/60 ml-2 text-[11px]">{s.label}</span>
                </div>
                <span className="text-text-dim shrink-0 font-mono text-[11px]">
                  {formatDate(s.start)} — {s.endLabel}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trofeos */}
      {trophies.length > 0 && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Trofeos</h2>
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
                      <span className="font-display text-accent-gold text-base font-bold">
                        ×{trophy.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transferencias */}
      {transfers.length > 0 && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Transferencias</h2>
          <div className="space-y-2">
            {transfers.map((t, i) => {
              let contractYear: string | null = null
              if (t.contractUntil) {
                const parts = t.contractUntil.split(' ')[0].split('-')
                if (parts.length === 3) contractYear = parts[2]
              }
              return (
                <div
                  key={i}
                  className="bg-bg-card border-border-card flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    {t.competitorBadge ? (
                      <img
                        src={t.competitorBadge}
                        alt=""
                        className="bg-bg-elevated h-5 w-5 shrink-0 rounded-full object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : t.competitorName ? (
                      <span className="bg-bg-elevated font-body text-text-dim flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]">
                        {t.competitorName.charAt(0)}
                      </span>
                    ) : null}
                    <span className="font-body text-text-primary text-sm">{t.transferTitle}</span>
                    {contractYear && (
                      <span className="text-text-dim ml-2 font-mono text-[11px]">Hasta {contractYear}</span>
                    )}
                  </div>
                  <span className="text-text-muted font-mono text-xs">{formatDate(t.date)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
