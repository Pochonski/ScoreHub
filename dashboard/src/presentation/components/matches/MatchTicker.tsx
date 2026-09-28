import { memo, useRef, useCallback } from 'react'
import type { Game } from '@/domain/entities/Game'
import { MatchCard } from './MatchCard'

interface MatchTickerProps {
  games: Game[]
  featuredId?: number
  onSelect?: (game: Game) => void
}

export const MatchTicker = memo(function MatchTicker({ games, featuredId, onSelect }: MatchTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = direction === 'left' ? -300 : 300
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }, [])

  if (games.length === 0) return null

  return (
    <section
      aria-label="Lista rápida de partidos"
      className="scroll-fade-right group/ticker relative"
    >
      {/* Left arrow: visible solo en md+ (donde hay mouse/hover). focus-within para teclado. */}
      <button
        onClick={() => scroll('left')}
        className="from-bg-base focus-visible absolute top-0 bottom-2 left-0 z-10 my-auto hidden h-11 w-11 items-center justify-center bg-gradient-to-r to-transparent opacity-0 transition-opacity group-hover/ticker:opacity-100 group-focus-within/ticker:opacity-100 focus:opacity-100 md:flex"
        aria-label="Desplazar a la izquierda"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-muted"
        >
          <path d="M10 12L6 8l4-4" />
        </svg>
      </button>

      <div
        ref={scrollRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
      >
        {games.map((game) => (
          <div
            key={game.id}
            className={`shrink-0 snap-start transition-all duration-200 ${
              game.id === featuredId
                ? 'rounded-xl ring-2 ring-accent-gold/50'
                : 'opacity-65 hover:opacity-100'
            }`}
          >
            <MatchCard game={game} onSelect={onSelect} compact />
          </div>
        ))}
      </div>

      {/* Right arrow: visible solo en md+. focus-within para teclado. */}
      <button
        onClick={() => scroll('right')}
        className="from-bg-base focus-visible absolute top-0 right-0 bottom-2 z-10 my-auto hidden h-11 w-11 items-center justify-center bg-gradient-to-l to-transparent opacity-0 transition-opacity group-hover/ticker:opacity-100 group-focus-within/ticker:opacity-100 focus:opacity-100 md:flex"
        aria-label="Desplazar a la derecha"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-muted"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
      </button>
    </section>
  )
})
