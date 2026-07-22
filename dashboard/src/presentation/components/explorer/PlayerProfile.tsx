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
  /** When true, supplement fetches (career/trophies/transfers) failed but
   *  the core profile loaded. We render a small banner so users know. */
  partialData?: boolean
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

/**
 * Career stats come from upstream as:
 *   { seasonKey, name, stats: { categories, tables, legend } }
 *
 * `tables` is the most readable for human display: array of stat tables,
 * each with rows of (label, value) pairs grouped under a header.
 */
function flattenCareerTables(tables: unknown): { label: string; value: string | number }[] {
  if (!Array.isArray(tables)) return []
  const out: { label: string; value: string | number }[] = []
  for (const tbl of tables) {
    if (!tbl || typeof tbl !== 'object') continue
    const t = tbl as { name?: string; title?: string; rows?: unknown[] }
    const header = t.name || t.title
    if (Array.isArray(t.rows)) {
      for (const row of t.rows) {
        if (!row || typeof row !== 'object') continue
        const r = row as { name?: string; title?: string; value?: string | number; displayValue?: string | number }
        const label = r.name || r.title
        const value = r.displayValue ?? r.value
        if (label != null && value != null) {
          out.push({ label: header ? `${header} · ${label}` : String(label), value })
        }
      }
    }
  }
  return out
}

export function PlayerProfile({ athlete, career, trophies, transfers, partialData }: PlayerProfileProps) {
  const teamStints = buildTeamTimeline(transfers)

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

      {/* Estadísticas por temporada */}
      {career.length > 0 && (
        <section>
          <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Estadísticas</h2>
          <div className="space-y-3">
            {career.map((s) => {
              const rows = flattenCareerTables(s.stats?.tables)
              if (!rows.length) return null
              return (
                <details
                  key={s.seasonKey}
                  open={s.seasonKey !== '-1'}
                  className="bg-bg-card border-border-card rounded-lg border"
                >
                  <summary className="font-body text-text-primary cursor-pointer list-none px-3 py-2 text-sm font-medium select-none">
                    {s.name}
                  </summary>
                  <div className="border-border-card/50 space-y-1 border-t px-3 py-2 text-sm">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="font-body text-text-muted truncate">{r.label}</span>
                        <span className="text-text-primary font-mono">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </details>
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

      {/* Transferencias */}
      <section>
        <h2 className="font-display text-text-primary mb-3 text-lg font-semibold">Transferencias</h2>
        {transfers.length > 0 ? (
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
        ) : (
          <p className="font-body text-text-dim text-sm">Sin transferencias registradas.</p>
        )}
      </section>
    </div>
  )
}