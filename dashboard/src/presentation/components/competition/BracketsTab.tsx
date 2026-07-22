import { useState, useEffect } from 'react'
import type { BracketStage } from '@/domain/entities/Bracket'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'
import { TeamBadge } from '@/presentation/components/ui/TeamBadge'
import { BracketTree } from './BracketTree'

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

function AccordionSection({
  title,
  defaultOpen,
  children,
}: {
  title: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="bg-bg-card border-border-card overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-bg-elevated/20 focus-visible flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="font-display text-text-primary text-base font-semibold">{title}</span>
        <span
          className={`text-text-dim shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5l4 4 4-4" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-border-card/50 divide-border-card/50 divide-y border-t">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function BracketsTab({ competitionId }: { competitionId?: number }) {
  const [stages, setStages] = useState<BracketStage[]>([])
  const [loading, setLoading] = useState(true)
  const [treeView, setTreeView] = useState(false)

  useEffect(() => {
    apiClient
      .get<BracketStage[]>(ENDPOINTS.brackets, {
        params: competitionId ? { competitionId } : undefined,
      })
      .then(setStages)
      .catch(() => setStages([]))
      .finally(() => setLoading(false))
  }, [competitionId])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-card border-border-card skeleton overflow-hidden rounded-xl border">
            <div className="h-12" />
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="bg-bg-elevated h-8 w-8 rounded-full" />
                  <div className="bg-bg-elevated h-4 w-20 rounded" />
                </div>
                <div className="bg-bg-elevated h-4 w-8 rounded" />
              </div>
            ))}
          </div>
        ))}
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
    <div>
      {/* Toggle vista árbol: solo se ofrece en md+ (el árbol horizontal es
          ilegible en mobile). El default mobile es vista lista. */}
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => setTreeView(!treeView)}
          className="font-body text-accent-blue hover:text-accent-blue/80 focus-visible hidden text-xs transition-colors md:block"
          aria-pressed={treeView}
          title="La vista árbol requiere pantalla grande"
        >
          {treeView ? 'Vista lista' : 'Vista árbol'}
        </button>
      </div>

      {treeView ? (
        <BracketTree />
      ) : (
        <div className="space-y-3">
          {stages.map((stage) => (
            <AccordionSection
              key={stage.name}
              title={
                <span className="flex items-center gap-2">
                  {stage.name}
                  {stage.games.length > 0 && (
                    <span className="text-text-dim font-mono text-[11px] font-normal tracking-wider uppercase">
                      ({stage.games.length} partido{stage.games.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </span>
              }
              defaultOpen
            >
              {stage.games.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="font-body text-text-muted text-xs">Partidos aún no definidos</p>
                </div>
              ) : (
                stage.games.map((game) => (
                  <div
                    key={game.id}
                    className="odd:bg-bg-elevated/20 flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <TeamBadge src={game.homeTeam?.badgeUrl} name={game.homeTeam?.name || '?'} size="sm" />
                      <span className="font-body text-text-primary truncate text-sm">
                        {game.homeTeam?.name || 'Por definir'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {game.score ? (
                        <span className="font-display text-text-primary text-lg font-bold">
                          {game.score.home}–{game.score.away}
                        </span>
                      ) : game.startTime ? (
                        <span className="text-text-dim text-right font-mono text-[11px] leading-tight">
                          {formatTime(game.startTime)}
                        </span>
                      ) : (
                        <span className="text-text-dim font-mono text-[11px]">VS</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                      <span className="font-body text-text-primary truncate text-sm">
                        {game.awayTeam?.name || 'Por definir'}
                      </span>
                      <TeamBadge src={game.awayTeam?.badgeUrl} name={game.awayTeam?.name || '?'} size="sm" />
                    </div>
                  </div>
                ))
              )}
            </AccordionSection>
          ))}
        </div>
      )}
    </div>
  )
}
