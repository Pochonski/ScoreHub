import type { ReactNode } from 'react'
import { useTournamentStats } from '@/presentation/hooks/useTournamentStats'
import { TopScorers } from '@/presentation/components/stats/TopScorers'
import { Assists } from '@/presentation/components/stats/Assists'
import { Ratings } from '@/presentation/components/stats/Ratings'
import { TeamOfWeekPitch } from '@/presentation/components/stats/TeamOfWeekPitch'
import type { TeamOfWeekPlayer } from '@/presentation/components/stats/TeamOfWeek'

function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-2xl border">
      <div className="border-border-card border-b px-4 py-3">
        <h3 className="font-body text-text-muted flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="px-2 py-2">{children}</div>
    </div>
  )
}

export function StatsTab({ competitionId, seasonNum }: { competitionId?: number; seasonNum?: number }) {
  const { scorers, assists, ratings, teamOfWeek, loading } = useTournamentStats(competitionId, seasonNum)

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-bg-card border-border-card skeleton h-80 rounded-2xl border" />
        ))}
      </div>
    )
  }

  const lists: { title: string; empty: string; node: ReactNode }[] = [
    {
      title: 'Goleadores',
      empty: 'Esta competición no publica goleadores',
      node: scorers.length > 0 ? <TopScorers scorers={scorers} hideTitle /> : null,
    },
    {
      title: 'Asistencias',
      empty: 'Esta competición no publica asistencias',
      node: assists.length > 0 ? <Assists assists={assists} hideTitle /> : null,
    },
    {
      title: 'Valoraciones',
      empty: 'Esta competición no publica valoraciones',
      node: ratings.length > 0 ? <Ratings ratings={ratings} hideTitle /> : null,
    },
  ]

  const hasTeamOfWeek = !!teamOfWeek && teamOfWeek.players.length > 0

  if (lists.every((l) => !l.node) && !hasTeamOfWeek) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">Estadísticas del torneo no disponibles</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {lists.map((l) => (
          <StatCard key={l.title} title={l.title}>
            {l.node ?? (
              <p className="font-body text-text-dim px-2 py-6 text-center text-xs">{l.empty}</p>
            )}
          </StatCard>
        ))}
      </div>

      {hasTeamOfWeek && teamOfWeek && (
        <div className="bg-bg-card border-border-card rounded-2xl border p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-body text-text-muted flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
              Once Ideal
            </h3>
            <span className="bg-bg-elevated text-text-muted font-mono rounded-full px-2 py-0.5 text-[11px] tracking-wider">
              {teamOfWeek.formation}
            </span>
          </div>
          <TeamOfWeekPitch
            formation={teamOfWeek.formation}
            players={teamOfWeek.players as TeamOfWeekPlayer[]}
          />
        </div>
      )}
    </div>
  )
}
