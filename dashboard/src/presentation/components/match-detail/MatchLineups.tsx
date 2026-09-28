import { memo, useState } from 'react'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import type { Game } from '@/domain/entities/Game'
import type { Lineup, LineupMember } from '@/domain/entities/Lineup'

interface MatchLineupsProps {
  game: Game
  lineups: { home: Lineup; away: Lineup } | null
}

const PlayerPhoto = memo(function PlayerPhoto({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)
  if (error || !src) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated">
        <span className="text-[11px] sm:text-[10px] text-text-dim">{alt.charAt(0)}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-8 w-8 rounded-full object-cover bg-bg-base"
      onError={() => setError(true)}
      loading="lazy"
    />
  )
})

function LineupSide({
  side,
  team,
}: {
  side: Lineup
  team: Game['homeTeam']
}) {
  const members = side?.members ?? []
  // El endpoint dedicado marca isStarter; si no viene, asumir titulares.
  const starters = members.filter((m) => m.isStarter !== false)
  const subs = members.filter((m) => m.isStarter === false)

  return (
    <div className="rounded-lg bg-bg-card/70 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <TeamBadge src={team.badgeUrl} name={team.name} size="sm" />
        <span className="truncate">{team.name}</span>
        {side?.formation && <span className="ml-auto text-text-dim font-mono text-xs">({side.formation})</span>}
      </div>

      {starters.length > 0 && (
        <ul className="space-y-1.5">
          {starters.map((m, i) => (
            <LineupMemberRow key={`s-${i}`} member={m} />
          ))}
        </ul>
      )}

      {subs.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-[11px] sm:text-[10px] uppercase tracking-wider text-text-dim">Suplentes</p>
          <ul className="space-y-1">
            {subs.map((m, i) => (
              <LineupMemberRow key={`b-${i}`} member={m} compact />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function LineupMemberRow({ member, compact = false }: { member: LineupMember; compact?: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      {member.shirtNumber != null && (
        <span className="w-5 shrink-0 text-right font-mono text-[11px] sm:text-[10px] text-text-dim">{member.shirtNumber}</span>
      )}
      {!compact && <PlayerPhoto src={member.photoUrl ?? ''} alt={member.name} />}
      <span className="truncate text-text-muted">{member.name}</span>
      {member.position && <span className="ml-auto shrink-0 text-[11px] sm:text-[10px] text-text-dim">{member.position}</span>}
      {member.rating != null && !compact && (
        <span className="shrink-0 font-mono text-[11px] sm:text-[10px] text-accent-gold">{Number(member.rating).toFixed(1)}</span>
      )}
    </li>
  )
}

export const MatchLineups = memo(function MatchLineups({ game, lineups }: MatchLineupsProps) {
  if (!lineups || (!lineups.home?.members?.length && !lineups.away?.members?.length)) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border-card bg-bg-card">
      <div className="border-b border-border-card/50 px-5 py-4">
        <h3 className="text-[11px] uppercase tracking-wider text-text-dim">Alineaciones</h3>
      </div>
      <div
        className="relative overflow-hidden rounded-b-xl p-5"
        style={{
          backgroundImage: 'url(/images/pitch-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lineups.home && <LineupSide side={lineups.home} team={game.homeTeam} />}
          {lineups.away && <LineupSide side={lineups.away} team={game.awayTeam} />}
        </div>
      </div>
    </div>
  )
})
