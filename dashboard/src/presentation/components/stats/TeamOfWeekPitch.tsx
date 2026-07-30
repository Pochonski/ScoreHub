import { useState } from 'react'
import type { TeamOfWeekPlayer } from './TeamOfWeek'

interface TeamOfWeekPitchProps {
  formation: string
  players: TeamOfWeekPlayer[]
}

// Filas por formación: [portero, defensa, medio, ...ataque]
const formationRows: Record<string, number[]> = {
  '4-4-2': [1, 4, 4, 2],
  '4-3-3': [1, 4, 3, 3],
  '4-2-3-1': [1, 4, 2, 3, 1],
  '4-5-1': [1, 4, 5, 1],
  '3-5-2': [1, 3, 5, 2],
  '3-4-3': [1, 3, 4, 3],
  '5-3-2': [1, 5, 3, 2],
  '5-4-1': [1, 5, 4, 1],
}

function PlayerAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [failed, setFailed] = useState(false)
  if (!photoUrl || failed) {
    return (
      <span className="font-display flex h-full w-full items-center justify-center text-sm text-white/80">
        {name.charAt(0)}
      </span>
    )
  }
  return (
    <img
      src={photoUrl}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function PitchLines() {
  return (
    <svg
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="284" height="384" rx="2" />
      <line x1="8" y1="200" x2="292" y2="200" />
      <circle cx="150" cy="200" r="34" />
      <circle cx="150" cy="200" r="2" fill="rgba(255,255,255,0.25)" stroke="none" />
      {/* Área superior */}
      <rect x="82" y="8" width="136" height="58" />
      <rect x="116" y="8" width="68" height="24" />
      {/* Área inferior */}
      <rect x="82" y="334" width="136" height="58" />
      <rect x="116" y="368" width="68" height="24" />
    </svg>
  )
}

export function TeamOfWeekPitch({ formation, players }: TeamOfWeekPitchProps) {
  if (players.length === 0) return null

  const rows = formationRows[formation] || formationRows['4-4-2']
  let idx = 0
  const rowNodes = rows.map((count, rowIndex) => {
    const rowPlayers = players.slice(idx, idx + count)
    idx += count
    return (
      <div key={rowIndex} className="flex items-center justify-around px-2">
        {rowPlayers.map((p, i) => (
          <div key={i} className="flex w-16 flex-col items-center gap-1">
            <div className="relative">
              <div className="border-border-hover bg-bg-card h-11 w-11 overflow-hidden rounded-full border-2 shadow-lg">
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
              </div>
              {p.rating != null && (
                <span className="bg-accent-gold text-bg-base font-display absolute -right-1 -bottom-1 rounded-full px-1 text-[10px] font-bold shadow">
                  {p.rating.toFixed(1)}
                </span>
              )}
            </div>
            <span className="max-w-full truncate rounded bg-black/40 px-1 text-center text-[10px] leading-tight font-medium text-white">
              {p.name}
            </span>
          </div>
        ))}
      </div>
    )
  })

  return (
    <div
      className="border-border-card relative mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border"
      style={{
        aspectRatio: '3 / 4',
        backgroundImage:
          'repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0 44px, transparent 44px 88px), linear-gradient(to bottom, #123d29, #0b2b1c)',
      }}
    >
      <PitchLines />
      {/* Jugadores: portero abajo (flex-col-reverse), ataque arriba */}
      <div className="absolute inset-0 flex flex-col-reverse justify-around py-5">{rowNodes}</div>
    </div>
  )
}
