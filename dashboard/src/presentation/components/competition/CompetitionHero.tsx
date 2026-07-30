import { useState, type ReactNode } from 'react'
import { competitionLogoUrl, countryFlagUrl } from '@/shared/images'
import { useStandings } from '@/presentation/hooks/useStandings'
import { useTournamentStats } from '@/presentation/hooks/useTournamentStats'

interface CompetitionHeroProps {
  competitionId: number
  name: string
  countryId?: number | null
  countryName?: string | null
  imageVersion?: number
  editionLabel?: string | null
  formatLabel?: string | null
  seasonNum?: number | 'all' | null
  /** Selector de temporada + "ver todas" + banner de archivo. */
  children?: ReactNode
}

function CompetitionLogo({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="bg-bg-base/50 ring-border-hover flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2 ring-1 sm:h-24 sm:w-24">
      {failed ? (
        <span className="font-display text-accent-gold text-3xl font-bold">
          {name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img src={url} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      )}
    </div>
  )
}

function TeamCrestSmall({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className="bg-bg-elevated text-text-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
        {name.charAt(0)}
      </span>
    )
  }
  return (
    <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full">
      <img src={src} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
    </span>
  )
}

function StatCell({
  label,
  value,
  sub,
  media,
}: {
  label: string
  value: ReactNode
  sub?: string
  media?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="font-body text-text-dim text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {media}
        <div className="min-w-0">
          <p className="font-display text-text-primary truncate text-lg font-bold leading-tight">{value}</p>
          {sub && <p className="font-body text-text-muted truncate text-[11px]">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

export function CompetitionHero({
  competitionId,
  name,
  countryId,
  countryName,
  imageVersion,
  editionLabel,
  formatLabel,
  seasonNum,
  children,
}: CompetitionHeroProps) {
  const fetchSeason = seasonNum === 'all' || seasonNum == null ? undefined : seasonNum
  const { groups } = useStandings(competitionId, { seasonNum: fetchSeason })
  const { scorers } = useTournamentStats(competitionId, seasonNum === 'all' ? null : (seasonNum ?? null))

  const flag = countryFlagUrl(countryId)
  const logo = competitionLogoUrl(competitionId, imageVersion ?? 1)

  const allRows = groups.flatMap((g) => g.rows)
  const teamsCount = allRows.length
  const singleTable = groups.length === 1
  const leader = singleTable ? groups[0]?.rows[0] : null
  const topScorer = scorers[0]

  return (
    <div className="border-border-card relative mb-8 overflow-hidden rounded-3xl border">
      {/* Bandera como marca de agua */}
      {flag && (
        <img
          src={flag}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-6 h-64 w-64 rotate-6 object-cover opacity-[0.08] blur-[2px]"
        />
      )}
      {/* Degradados */}
      <div className="from-bg-elevated via-bg-card to-bg-base absolute inset-0 bg-gradient-to-br" aria-hidden="true" />
      <div className="from-accent-gold/[0.06] absolute inset-0 bg-gradient-to-r to-transparent" aria-hidden="true" />

      <div className="relative p-5 sm:p-8">
        {/* Fila superior: logo + título + selector de temporada */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <CompetitionLogo url={logo} name={name} />

          <div className="min-w-0 flex-1">
            <div className="font-body text-text-muted mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {flag && (
                <span className="h-3.5 w-5 overflow-hidden rounded-[2px]">
                  <img src={flag} alt="" className="h-full w-full object-cover" />
                </span>
              )}
              {countryName && <span className="font-medium">{countryName}</span>}
              {editionLabel && (
                <>
                  <span className="text-text-dim">·</span>
                  <span>{editionLabel}</span>
                </>
              )}
              {formatLabel && (
                <span className="bg-accent-gold/10 text-accent-gold ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                  {formatLabel}
                </span>
              )}
            </div>
            <h1 className="font-display text-text-primary text-3xl font-bold tracking-wide sm:text-4xl">
              {name}
            </h1>
          </div>

          {children && <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">{children}</div>}
        </div>

        {/* Tira de stats */}
        <div className="border-border-card mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
          <StatCell label="Equipos" value={teamsCount || '—'} />
          {singleTable && leader ? (
            <StatCell
              label="Líder"
              value={leader.team.name}
              sub={`${leader.points} pts`}
              media={<TeamCrestSmall src={leader.team.badgeUrl} name={leader.team.name} />}
            />
          ) : (
            <StatCell label="Grupos" value={groups.length || '—'} />
          )}
          {topScorer ? (
            <StatCell
              label="Goleador"
              value={topScorer.name}
              sub={`${topScorer.value} ${topScorer.value === 1 ? 'gol' : 'goles'}`}
              media={<TeamCrestSmall src={topScorer.photoUrl} name={topScorer.name} />}
            />
          ) : (
            <StatCell label="Goleador" value="—" />
          )}
          <StatCell label="Formato" value={formatLabel || 'Liga'} />
        </div>
      </div>
    </div>
  )
}
