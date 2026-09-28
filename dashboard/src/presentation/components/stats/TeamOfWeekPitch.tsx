import { useState } from 'react'
import type { TeamOfWeekPlayer } from './TeamOfWeek'

interface TeamOfWeekPitchProps {
  formation: string
  players: TeamOfWeekPlayer[]
}

/**
 * Línea táctica de un jugador (0=portero … 3=delantero, 4=desconocida).
 * El upstream trae `position` en español ("Portero", "Defensor",
 * "Mediocampista", "Delantero") pero se aceptan variantes EN por robustez.
 * -1 = no-jugador (DT, staff): se excluye del once.
 */
export function playerLine(position: string | null | undefined): number {
  const p = (position || '').toLowerCase()
  if (!p) return 4
  if (/direc|entrenador|t[eé]cnico|coach|manager|staff|fisio|m[eé]dico|utilero|preparador/.test(p)) return -1
  if (/porter|goalkeeper|arquero|golero/.test(p)) return 0
  if (/defens|zaguero|lateral|central|carrilero|full[\s-]?back|centre[\s-]?back|defender/.test(p)) return 1
  if (/mediocamp|centrocamp|midfield|pivote|volante|interior/.test(p)) return 2
  if (/delanter|atacant|forward|striker|extremo|winger|ariete/.test(p)) return 3
  return 4
}

/**
 * Parsea '4-2-3-1' → [1,4,2,3,1] (portero + líneas). Fallback 4-4-2 si la
 * formación no parsea o no suma un once válido (10-12 incl. portero).
 */
export function parseFormation(formation: string): number[] {
  const fallback = [1, 4, 4, 2]
  const parts = (formation || '').split('-').map((s) => parseInt(s.trim(), 10))
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n) || n < 1 || n > 6)) {
    return fallback
  }
  const rows = [1, ...parts]
  const total = rows.reduce((a, b) => a + b, 0)
  if (total < 10 || total > 12) return fallback
  return rows
}

/**
 * Ordena el once por línea (portero primero) y rating desc dentro de cada
 * línea. El upstream NO viene ordenado posicionalmente, así que repartir
 * el array crudo por filas ponía a cualquiera en cualquier lado.
 */
export function orderPlayersByLine<T extends { position?: string | null; rating?: number | null }>(
  players: T[]
): T[] {
  return [...players]
    .filter((p) => playerLine(p.position) !== -1)
    .sort((a, b) => {
      const lineDiff = playerLine(a.position) - playerLine(b.position)
      if (lineDiff !== 0) return lineDiff
      return (b.rating ?? -1) - (a.rating ?? -1)
    })
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

  const ordered = orderPlayersByLine(players)
  if (ordered.length === 0) return null
  const rows = parseFormation(formation)
  // Offset de inicio de cada fila (suma de las anteriores) — sin mutar
  // variables en render (regla react-hooks/purity).
  const starts = rows.map((_, i) => rows.slice(0, i).reduce((a, b) => a + b, 0))
  const rowNodes = rows.map((count, rowIndex) => {
    const rowPlayers = ordered.slice(starts[rowIndex], starts[rowIndex] + count)
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
