import { useEffect, useRef, useState } from 'react'

interface BroadcastScoreProps {
  homeScore?: number
  awayScore?: number
  homeTeam: string
  awayTeam: string
  homeBadge?: string
  awayBadge?: string
  isLive: boolean
}

export function BroadcastScore({
  homeScore,
  awayScore,
  homeTeam,
  awayTeam,
  homeBadge,
  awayBadge,
  isLive,
}: BroadcastScoreProps) {
  const [animate, setAnimate] = useState(false)
  const prevHomeRef = useRef(homeScore)
  const prevAwayRef = useRef(awayScore)

  useEffect(() => {
    if (
      (prevHomeRef.current != null && homeScore != null && prevHomeRef.current !== homeScore) ||
      (prevAwayRef.current != null && awayScore != null && prevAwayRef.current !== awayScore)
    ) {
      setAnimate(true)
      const timer = setTimeout(() => setAnimate(false), 600)
      prevHomeRef.current = homeScore
      prevAwayRef.current = awayScore
      return () => clearTimeout(timer)
    }
    prevHomeRef.current = homeScore
    prevAwayRef.current = awayScore
  }, [homeScore, awayScore])

  const hasScore = homeScore != null && awayScore != null

  return (
    <div className="relative flex items-center justify-center gap-4 sm:gap-8 md:gap-12">
      {isLive && animate && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="goal-ray via-accent-gold absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent to-transparent" />
        </div>
      )}

      <div className="flex max-w-[120px] flex-1 flex-col items-center gap-2">
        <div className="bg-bg-elevated flex h-16 w-16 items-center justify-center overflow-hidden rounded-full sm:h-20 sm:w-20 md:h-24 md:w-24">
          {homeBadge ? (
            <img src={homeBadge} alt={homeTeam} className="h-full w-full object-contain" loading="eager" />
          ) : (
            <span className="font-display text-text-muted text-2xl font-bold">{homeTeam.charAt(0)}</span>
          )}
        </div>
        <span className="font-body text-text-primary text-center text-xs leading-tight font-medium sm:text-sm">
          {homeTeam}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div
          className={`font-display text-text-primary text-[clamp(56px,10vw,96px)] leading-none font-bold select-none ${animate ? 'score-animate' : ''}`}
        >
          {hasScore ? (
            <span className="flex items-center gap-2 sm:gap-4">
              <span>{homeScore}</span>
              <span className="text-text-muted/40 text-[clamp(32px,5vw,48px)]">:</span>
              <span>{awayScore}</span>
            </span>
          ) : (
            <span className="text-text-muted/40 font-body text-[clamp(24px,4vw,40px)] font-normal">VS</span>
          )}
        </div>
      </div>

      <div className="flex max-w-[120px] flex-1 flex-col items-center gap-2">
        <div className="bg-bg-elevated flex h-16 w-16 items-center justify-center overflow-hidden rounded-full sm:h-20 sm:w-20 md:h-24 md:w-24">
          {awayBadge ? (
            <img src={awayBadge} alt={awayTeam} className="h-full w-full object-contain" loading="eager" />
          ) : (
            <span className="font-display text-text-muted text-2xl font-bold">{awayTeam.charAt(0)}</span>
          )}
        </div>
        <span className="font-body text-text-primary text-center text-xs leading-tight font-medium sm:text-sm">
          {awayTeam}
        </span>
      </div>
    </div>
  )
}
