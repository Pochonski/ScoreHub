import { memo, useState } from 'react'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import type { Game } from '@/domain/entities/Game'
import type { Lineup } from '@/domain/entities/Lineup'

interface MatchLineupsProps {
  game: Game
  lineups: { home: Lineup; away: Lineup } | null
}

const PlayerPhoto = memo(function PlayerPhoto({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)
  if (error) return null
  return (
    <img
      src={src}
      alt={alt}
      className="bg-bg-base h-5 w-5 rounded-full object-cover"
      onError={() => setError(true)}
      loading="lazy"
    />
  )
})

export const MatchLineups = memo(function MatchLineups({ game, lineups }: MatchLineupsProps) {
  if (!lineups || (!lineups.home?.members?.length && !lineups.away?.members?.length)) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">Alineaciones</h3>
      </div>
      <div
        className="relative overflow-hidden rounded-b-xl p-5"
        style={{
          backgroundImage: 'url(/images/pitch-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[lineups.home, lineups.away].map((side, si) => {
            if (!side?.members?.length) return null
            const team = si === 0 ? game.homeTeam : game.awayTeam
            return (
              <div key={si} className="bg-bg-card/70 rounded-lg p-4 backdrop-blur-sm">
                <div className="font-body text-text-primary mb-3 flex items-center gap-2 text-sm font-semibold">
                  <TeamBadge src={team.badgeUrl} name={team.name} size="sm" />
                  {team.name}
                  {side.formation && (
                    <span className="text-text-dim ml-auto font-normal">({side.formation})</span>
                  )}
                </div>
                <ul className="space-y-1">
                  {side.members.map((m, i) => (
                    <li key={i} className="font-body text-text-muted flex items-center gap-2 text-xs">
                      {m.shirtNumber != null && (
                        <span className="text-text-dim w-5 shrink-0 text-right font-mono text-[10px]">
                          {m.shirtNumber}
                        </span>
                      )}
                      {m.photoUrl && <PlayerPhoto src={m.photoUrl} alt={m.name} />}
                      <span className="truncate">{m.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
