import { memo } from 'react'
import type { MatchEvent } from '@/domain/entities/Game'

interface MatchTimelineProps {
  timeline: MatchEvent[]
}

const EVENT_ICONS: Record<MatchEvent['type'], { icon: string; label: string }> = {
  goal: { icon: '⚽', label: 'Gol' },
  yellow_card: { icon: '🟨', label: 'Tarjeta amarilla' },
  red_card: { icon: '🟥', label: 'Tarjeta roja' },
  substitution: { icon: '🔄', label: 'Sustitución' },
  penalty: { icon: '⚽', label: 'Penalti' },
}

export const MatchTimeline = memo(function MatchTimeline({ timeline }: MatchTimelineProps) {
  if (timeline.length === 0) return null

  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[10px] tracking-wider uppercase">Eventos</h3>
      </div>
      <div className="p-5">
        <div className="space-y-2">
          {timeline.map((ev, i) => {
            const meta = EVENT_ICONS[ev.type] ?? { icon: '🔄', label: 'Evento' }
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-text-dim w-8 shrink-0 text-right font-mono text-xs">
                  {ev.minute}&apos;
                </span>
                <span role="img" aria-label={meta.label} className="shrink-0 text-xs">
                  {meta.icon}
                </span>
                <span className="font-body text-text-primary text-xs">
                  {ev.description || ev.playerName || ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
