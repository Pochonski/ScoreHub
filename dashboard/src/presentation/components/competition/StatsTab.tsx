import type { ReactNode } from 'react'
import { useTournamentStats } from '@/presentation/hooks/useTournamentStats'
import { TopScorers } from '@/presentation/components/stats/TopScorers'
import { Assists } from '@/presentation/components/stats/Assists'
import { Ratings } from '@/presentation/components/stats/Ratings'
import { TeamOfWeekPitch } from '@/presentation/components/stats/TeamOfWeekPitch'
import type { TeamOfWeekPlayer } from '@/presentation/components/stats/TeamOfWeek'

function StatCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-2xl border">
      <div className="border-border-card border-b px-4 py-3">
        <h3 className="font-body text-text-muted flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <span aria-hidden="true">{icon}</span> {title}
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

  const lists: { icon: string; title: string; node: ReactNode }[] = []
  if (scorers.length > 0)
    lists.push({ icon: '⚽', title: 'Goleadores', node: <TopScorers scorers={scorers} hideTitle /> })
  if (assists.length > 0)
    lists.push({ icon: '🅰️', title: 'Asistencias', node: <Assists assists={assists} hideTitle /> })
  if (ratings.length > 0)
    lists.push({ icon: '⭐', title: 'Valoraciones', node: <Ratings ratings={ratings} hideTitle /> })

  const hasTeamOfWeek = !!teamOfWeek && teamOfWeek.players.length > 0

  if (lists.length === 0 && !hasTeamOfWeek) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">Estadísticas del torneo no disponibles</p>
      </div>
    )
  }

  // Columnas según cuántas listas hay (evita una card sola muy ancha).
  const gridCols =
    lists.length >= 3 ? 'lg:grid-cols-3' : lists.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'

  return (
    <div className="space-y-4">
      {lists.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
          {lists.map((l) => (
            <StatCard key={l.title} icon={l.icon} title={l.title}>
              {l.node}
            </StatCard>
          ))}
        </div>
      )}

      {hasTeamOfWeek && teamOfWeek && (
        <div className="bg-bg-card border-border-card rounded-2xl border p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-body text-text-muted flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
              <span aria-hidden="true">🏆</span> Once Ideal
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
