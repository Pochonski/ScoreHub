import type { PreviewFormEntry } from '@/presentation/hooks/useMatchPreview'

function resultClasses(result: 'W' | 'D' | 'L') {
  return result === 'W'
    ? 'bg-accent-live/15 text-accent-live'
    : result === 'D'
      ? 'bg-text-dim/15 text-text-muted'
      : 'bg-accent-red/15 text-accent-red'
}

export function FormBadges({ teamId, entries }: { teamId: number; entries: PreviewFormEntry[] }) {
  if (entries.length === 0) {
    return <p className="font-body text-text-dim text-xs">Sin partidos recientes registrados</p>
  }
  const wins = entries.filter((e) => e.result === 'W').length
  const draws = entries.filter((e) => e.result === 'D').length
  const losses = entries.filter((e) => e.result === 'L').length
  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-text-dim text-[11px] tracking-wide uppercase">
        Últimos {entries.length}: {wins}V · {draws}E · {losses}D
      </p>
      <ul className="space-y-2">
        {entries.map((e) => {
          const isHome = e.game.homeTeam.id === teamId
          const opponent = isHome ? e.game.awayTeam.name : e.game.homeTeam.name
          return (
            <li key={e.gameId} className="flex items-center gap-2.5">
              <span
                className={`font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${resultClasses(e.result)}`}
              >
                {e.result}
              </span>
              <span className="font-mono text-text-primary text-sm font-bold">
                {e.scoreFor}-{e.scoreAgainst}
              </span>
              <span className="font-body text-text-muted min-w-0 flex-1 truncate text-xs">
                vs {opponent} · {isHome ? 'Casa' : 'Fuera'}
              </span>
              <span className="font-body text-text-dim shrink-0 text-[11px]">
                {e.startTime
                  ? new Date(e.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                  : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <div className="border-border-card/50 border-b px-5 py-4">
        <h3 className="font-body text-text-dim text-[11px] sm:text-[10px] tracking-wider uppercase">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
