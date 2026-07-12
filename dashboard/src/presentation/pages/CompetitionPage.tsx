import { useState } from 'react'
import { useTournamentInfo } from '@/presentation/hooks/useTournamentInfo'
import { StandingsTab } from '@/presentation/components/competition/StandingsTab'
import { BracketsTab } from '@/presentation/components/competition/BracketsTab'
import { StatsTab } from '@/presentation/components/competition/StatsTab'
import { HistoryTab } from '@/presentation/components/competition/HistoryTab'

const TABS = [
  { id: 'standings', label: 'Posiciones' },
  { id: 'brackets', label: 'Eliminatorias' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'history', label: 'Historia' },
] as const

type TabId = (typeof TABS)[number]['id']

export function CompetitionPage() {
  const [activeTab, setActiveTab] = useState<TabId>('standings')
  const { info, loading: infoLoading } = useTournamentInfo()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero header */}
      <div className="mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-3">
          <div className="via-accent-gold/40 h-px w-12 bg-gradient-to-r from-transparent to-transparent" />
          <div className="bg-accent-gold/60 h-2 w-2 rounded-full" />
          <div className="via-accent-gold/40 h-px w-12 bg-gradient-to-r from-transparent to-transparent" />
        </div>

        {infoLoading ? (
          <div className="space-y-3">
            <div className="bg-bg-elevated skeleton mx-auto h-8 w-64 rounded" />
            <div className="bg-bg-elevated skeleton mx-auto h-4 w-48 rounded" />
          </div>
        ) : (
          <>
            <h1 className="font-display text-text-primary text-3xl font-bold tracking-wide sm:text-4xl">
              Copa Mundial de la FIFA 2026
            </h1>
            <p className="font-body text-text-muted mt-2 flex items-center justify-center gap-2 text-sm">
              <span className="text-accent-gold font-mono text-[10px] tracking-widest uppercase">
                {info?.seasonNum ? `Edición ${info.seasonNum}` : '26.ª edición'}
              </span>
              <span className="text-text-dim">·</span>
              <span>48 equipos · 12 grupos · Fase eliminatoria</span>
            </p>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-8 flex items-center justify-center">
        <div className="bg-bg-card border-border-card inline-flex items-center gap-1 rounded-xl border p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`font-body focus-visible rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-accent-gold/10 text-accent-gold shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated/50'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'standings' && <StandingsTab />}
        {activeTab === 'brackets' && <BracketsTab />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
