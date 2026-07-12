import { useState, useEffect } from 'react'
import type { BracketStage } from '@/domain/entities/Bracket'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'

function formatTime(iso?: string): string {
  if (!iso) return ''
  try {
    return (
      new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) +
      ' · ' +
      new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
    )
  } catch {
    return ''
  }
}

const STAGE_ORDER = [
  'Round of 16',
  'Octavos de final',
  'Quarter-finals',
  'Cuartos de final',
  'Semi-finals',
  'Semifinales',
  '3rd Place',
  'Tercer lugar',
  'Final',
  'Final',
]

function stageRank(name: string): number {
  const idx = STAGE_ORDER.indexOf(name)
  return idx >= 0 ? idx : 99
}

export function BracketTree() {
  const [stages, setStages] = useState<BracketStage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<BracketStage[]>(ENDPOINTS.brackets)
      .then((data) => setStages(data.sort((a, b) => stageRank(a.name) - stageRank(b.name))))
      .catch(() => setStages([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 overflow-x-auto pb-4">
        <div className="flex min-w-[800px] gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[180px] flex-1 space-y-3">
              <div className="bg-bg-elevated skeleton h-5 w-24 rounded" />
              {Array.from({ length: 2 ** (3 - i) }).map((_, j) => (
                <div key={j} className="bg-bg-elevated skeleton h-16 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl p-6 text-center">
        <p className="font-body text-text-muted text-sm">Eliminatorias no disponibles</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-[800px] gap-6">
        {stages.map((stage, si) => {
          const totalGames = stage.games.length
          return (
            <div key={stage.name} className="min-w-[180px] flex-1">
              <h3 className="font-display text-accent-gold mb-4 text-center text-sm font-semibold tracking-wider uppercase">
                {stage.name}
              </h3>
              <div
                className="relative"
                style={{ paddingTop: totalGames <= 2 ? `${(2 - totalGames) * 40}px` : '0' }}
              >
                {stage.games.map((game, gi) => {
                  const bracketHeight = 56
                  return (
                    <div key={game.id}>
                      <div
                        className="bg-bg-card border-border-card hover:border-accent-blue/30 rounded-xl border p-3 transition-colors"
                        style={{ height: `${bracketHeight}px` }}
                      >
                        <div className="flex h-full items-center justify-between gap-1">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <TeamBadge
                              src={game.homeTeam?.badgeUrl}
                              name={game.homeTeam?.name || '?'}
                              size="sm"
                            />
                            <span className="font-body text-text-primary truncate text-xs">
                              {game.homeTeam?.name || '—'}
                            </span>
                          </div>
                          <div className="min-w-[32px] shrink-0 text-center">
                            {game.score ? (
                              <span className="font-display text-text-primary text-sm font-bold">
                                {game.score.home}–{game.score.away}
                              </span>
                            ) : game.startTime ? (
                              <span className="text-text-dim block font-mono text-[9px] leading-tight">
                                {formatTime(game.startTime)}
                              </span>
                            ) : (
                              <span className="text-text-dim font-mono text-[10px]">VS</span>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                            <span className="font-body text-text-primary truncate text-xs">
                              {game.awayTeam?.name || '—'}
                            </span>
                            <TeamBadge
                              src={game.awayTeam?.badgeUrl}
                              name={game.awayTeam?.name || '?'}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Connector line to next stage */}
                      {si < stages.length - 1 && (
                        <div className="flex justify-center" style={{ height: '24px' }}>
                          <div className="bg-border-hover h-full w-px" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
