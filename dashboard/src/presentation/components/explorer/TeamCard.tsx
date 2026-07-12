import type { Team } from '@/domain/entities/Team'
import type { Game } from '@/domain/entities/Game'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'

interface TeamCardProps {
  team: Team
  matches?: Game[]
}

export function TeamCard({ team, matches = [] }: TeamCardProps) {
  const played = matches.length
  const won = matches.filter((m) => {
    if (m.homeTeam.id === team.id) return (m.homeTeam.score ?? 0) > (m.awayTeam.score ?? 0)
    if (m.awayTeam.id === team.id) return (m.awayTeam.score ?? 0) > (m.homeTeam.score ?? 0)
    return false
  }).length
  const nextMatch = matches.find((m) => m.status === 'upcoming')

  return (
    <div className="bg-bg-card border-border-card rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-3">
        <TeamBadge src={team.badgeUrl} name={team.name} size="lg" />
        <div>
          <h3 className="font-display text-text-primary text-lg font-bold">{team.name}</h3>
          {team.flagUrl && (
            <span className="font-body text-text-muted text-xs">
              <img src={team.flagUrl} alt="" className="mr-1 inline h-3 w-4" />
              {team.countryId}
            </span>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-4 text-xs">
            <div className="text-center">
              <span className="font-display text-text-primary block text-lg font-bold">{played}</span>
              <span className="font-body text-text-dim">PJ</span>
            </div>
            <div className="text-center">
              <span className="font-display text-accent-live block text-lg font-bold">{won}</span>
              <span className="font-body text-text-dim">G</span>
            </div>
            <div className="text-center">
              <span className="font-display text-accent-red block text-lg font-bold">{played - won}</span>
              <span className="font-body text-text-dim">P</span>
            </div>
          </div>

          {nextMatch && (
            <div className="border-border-card border-t pt-2">
              <span className="font-body text-text-dim text-[10px] tracking-wider uppercase">
                Próximo partido
              </span>
              <p className="font-body text-text-primary mt-0.5 text-xs">
                {nextMatch.homeTeam.name} vs {nextMatch.awayTeam.name}
              </p>
              <p className="text-text-dim font-mono text-[10px]">
                {new Date(nextMatch.startTime).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
