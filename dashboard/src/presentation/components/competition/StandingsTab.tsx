import { useState } from 'react'
import { useStandings } from '@/presentation/hooks/useStandings'
import { GroupStandings } from '@/presentation/components/standings/GroupStandings'
import { StandingsSkeleton } from '@/presentation/components/ui/Skeleton'

interface Props {
  competitionId?: number
  seasonNum?: number
}

const STAGES = [
  { id: 1, label: 'General' },
  { id: 2, label: 'Apertura' },
] as const

export function StandingsTab({ competitionId, seasonNum }: Props) {
  const [stageNum, setStageNum] = useState<number>(1)
  const { groups, loading, error } = useStandings(competitionId, { stageNum, seasonNum })

  if (loading) return <StandingsSkeleton />

  if (error) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">{error}</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="bg-bg-card border-border-card rounded-xl border p-8 text-center">
        <p className="font-body text-text-muted text-sm">
          La tabla de posiciones aún no está disponible.
        </p>
      </div>
    )
  }

  const showStageSelector = groups.some(
    g => g.displayName && g.displayName.toLowerCase().includes('apertura')
  )

  return (
    <div className="space-y-3">
      {showStageSelector && (
        <div className="flex justify-end">
          <div className="bg-bg-card border-border-card inline-flex gap-1 rounded-full border p-1">
            {STAGES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStageNum(s.id)}
                className={`font-body focus-visible min-h-[44px] rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  stageNum === s.id
                    ? 'bg-accent-gold/15 text-accent-gold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.map(group => (
        <div
          key={group.name + stageNum}
          className="bg-bg-card border-border-card overflow-hidden rounded-xl border"
        >
          <div className="border-border-card border-b px-4 py-3">
            <h3 className="font-display text-text-primary text-base font-semibold">
              {group.displayName || group.name}
            </h3>
          </div>
          <GroupStandings groups={[group]} hideHeader />
        </div>
      ))}
    </div>
  )
}
