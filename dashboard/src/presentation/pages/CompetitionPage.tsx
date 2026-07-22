import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTournamentInfo } from '@/presentation/hooks/useTournamentInfo'
import { useCompetitionDetail } from '@/presentation/hooks/useCompetitions'
import { StandingsTab } from '@/presentation/components/competition/StandingsTab'
import { BracketsTab } from '@/presentation/components/competition/BracketsTab'
import { StatsTab } from '@/presentation/components/competition/StatsTab'
import { HistoryTab } from '@/presentation/components/competition/HistoryTab'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

type TabId = 'standings' | 'brackets' | 'stats' | 'history'

interface TabDef {
  id: TabId
  label: string
  requireFlag?: 'hasGroups' | 'hasBrackets'
}

const ALL_TABS: readonly TabDef[] = [
  { id: 'standings', label: 'Posiciones', requireFlag: 'hasGroups' },
  { id: 'brackets', label: 'Eliminatorias', requireFlag: 'hasBrackets' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'history', label: 'Historia' },
]

function isValidTab(tab: string | undefined): tab is TabId {
  return !!tab && ALL_TABS.some(t => t.id === tab)
}

export function CompetitionPage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string; tab?: string }>()
  const competitionId = useMemo(() => {
    const id = parseInt(params.id || '', 10)
    return Number.isFinite(id) ? id : null
  }, [params.id])

  // Tab: por URL o por defecto 'standings'. Si es inválido, fallback.
  const requestedTab: TabId = isValidTab(params.tab) ? params.tab : 'standings'
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab)

  // Sincronizar el tab cuando cambia el param de URL (back/forward).
  useEffect(() => {
    setActiveTab(requestedTab)
  }, [requestedTab])

  const { detail, loading: detailLoading } = useCompetitionDetail(competitionId)
  const { info, loading: infoLoading } = useTournamentInfo(competitionId)

  // Determinar tabs visibles según las flags de la competición.
  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter(t => {
      if (!t.requireFlag) return true
      return detail?.[t.requireFlag] === true
    })
  }, [detail])

  // Si el tab activo ya no es visible (cambio de comp sin brackets), redirige al primero disponible.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTab)) {
      const first = visibleTabs[0].id
      setActiveTab(first)
      if (competitionId != null) {
        navigate(`/competicion/${competitionId}/${first}`, { replace: true })
      }
    }
  }, [visibleTabs, activeTab, competitionId, navigate])

  if (competitionId == null) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ErrorState message="Competición inválida" />
      </div>
    )
  }

  if (detailLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
        <div className="space-y-3 text-center">
          <div className="bg-bg-elevated skeleton mx-auto h-8 w-72 rounded" />
          <div className="bg-bg-elevated skeleton mx-auto h-4 w-48 rounded" />
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ErrorState
          message={`No se encontró la competición ${competitionId}.`}
          onAction={() => navigate('/competiciones')}
          actionLabel="Ver competiciones"
        />
      </div>
    )
  }

  const setTab = (tab: TabId) => {
    setActiveTab(tab)
    navigate(`/competicion/${competitionId}/${tab}`)
  }

  const titleText = info?.name || detail.displayName
  const subtitleParts = [
    info?.seasonNum ? `Edición ${info.seasonNum}` : null,
    info?.countryName || detail.countryName,
    detail.hasGroups && detail.hasBrackets && 'Grupos + Eliminatorias',
    detail.hasGroups && !detail.hasBrackets && 'Fase única',
    detail.hasBrackets && !detail.hasGroups && 'Solo eliminatorias',
  ].filter(Boolean)

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
              {titleText}
            </h1>
            {subtitleParts.length > 0 && (
              <p className="font-body text-text-muted mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
                {subtitleParts.map((s, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-text-dim">·</span>}
                    <span>{s}</span>
                  </span>
                ))}
              </p>
            )}
          </>
        )}

        {/* Switcher a otras competiciones */}
        <button
          type="button"
          onClick={() => navigate('/competiciones')}
          className="font-body text-text-muted hover:text-accent-gold mt-4 inline-flex items-center gap-1 text-xs transition-colors"
        >
          ← Ver todas las competiciones
        </button>
      </div>

      {/* Tabs: scroll horizontal en mobile si no caben, centrado en desktop. */}
      {visibleTabs.length > 0 && (
        <div className="mb-8 flex justify-center">
          <div className="no-scrollbar bg-bg-card border-border-card inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border p-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`font-body focus-visible shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-accent-gold/10 text-accent-gold shadow-sm'
                    : 'text-text-muted hover:bg-bg-elevated/50 hover:text-text-primary'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'standings' && <StandingsTab competitionId={competitionId} />}
        {activeTab === 'brackets' && <BracketsTab competitionId={competitionId} />}
        {activeTab === 'stats' && <StatsTab competitionId={competitionId} />}
        {activeTab === 'history' && <HistoryTab competitionId={competitionId} />}
      </div>
    </div>
  )
}
