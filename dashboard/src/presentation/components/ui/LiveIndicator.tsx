interface LiveIndicatorProps {
  status: 'live' | 'upcoming' | 'finished'
  minute?: number
}

function displayMinute(minute: number | undefined): string | null {
  if (minute == null || !Number.isFinite(minute) || minute < 1) return null
  return `${Math.floor(minute)}'`
}

export function LiveIndicator({ status, minute }: LiveIndicatorProps) {
  if (status === 'live') {
    const shown = displayMinute(minute)
    return (
      <div className="flex items-center gap-1.5">
        <span className="bg-accent-live live-pulse h-1.5 w-1.5 rounded-full" aria-hidden="true" />
        <span className="text-accent-live font-body text-[11px] font-bold tracking-[0.08em] uppercase">
          EN VIVO
        </span>
        {shown && <span className="text-text-muted font-mono text-xs">{shown}</span>}
      </div>
    )
  }

  if (status === 'finished') {
    return (
      <span className="text-text-dim font-body text-[11px] font-bold tracking-[0.08em] uppercase">Final</span>
    )
  }

  return null
}
