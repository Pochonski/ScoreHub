interface LiveIndicatorProps {
  status: 'live' | 'upcoming' | 'finished'
  minute?: number
}

export function LiveIndicator({ status, minute }: LiveIndicatorProps) {
  if (status === 'live') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="bg-accent-live live-pulse h-1.5 w-1.5 rounded-full" />
        <span className="text-accent-live font-body text-[11px] font-bold tracking-[0.08em] uppercase">
          EN VIVO
        </span>
        {minute != null && <span className="text-text-muted font-mono text-xs">{minute}&apos;</span>}
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
