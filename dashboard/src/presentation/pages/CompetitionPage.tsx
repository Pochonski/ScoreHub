import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTournamentInfo } from '@/presentation/hooks/useTournamentInfo'
import { useCompetitionDetail, useCompetitions } from '@/presentation/hooks/useCompetitions'
import { useActiveCompetition } from '@/presentation/context/ActiveCompetitionContext'
import { useStandingsSeasons } from '@/presentation/hooks/useTransfersAndMore'
import { StandingsTab } from '@/presentation/components/competition/StandingsTab'
import { BracketsTab } from '@/presentation/components/competition/BracketsTab'
import { StatsTab } from '@/presentation/components/competition/StatsTab'
import { HistoryTab } from '@/presentation/components/competition/HistoryTab'
import { TransfersTab } from '@/presentation/components/competition/TransfersTab'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

type TabId = 'standings' | 'brackets' | 'stats' | 'transfers' | 'history'

interface TabDef {
  id: TabId
  label: string
  requireFlag?: 'hasGroups' | 'hasBrackets'
  showIf?: (comp: { hasTransfers?: boolean } | null) => boolean
}

const ALL_TABS: readonly TabDef[] = [
  { id: 'standings', label: 'Posiciones', requireFlag: 'hasGroups' },
  { id: 'brackets', label: 'Eliminatorias', requireFlag: 'hasBrackets' },
  {
    id: 'transfers',
    label: 'Fichajes',
    showIf: c => c?.hasTransfers === true,
  },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'history', label: 'Historia' },
]

function isValidTab(tab: string | undefined): tab is TabId {
  return !!tab && (ALL_TABS as readonly { id: string }[]).some(t => t.id === tab)
}

/**
 * SeasonSelector — dropdown para cambiar entre la temporada activa y las
 * anteriores. La temporada activa viene de `active_competitions.season_num`;
 * las anteriores vienen del endpoint `/standings/seasons` (que devuelve el
 * filtro de temporadas del upstream, ej. 88 temporadas para Ligue 1).
 */
function SeasonSelector({
  competitionId,
  activeSeasonNum,
}: {
  competitionId: number
  activeSeasonNum: number
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { seasons } = useStandingsSeasons(competitionId)

  const selectedSeason = (() => {
    const q = searchParams.get('season')
    if (q && q !== 'all') {
      const n = parseInt(q, 10)
      if (Number.isFinite(n)) return n
    }
    if (q === 'all') return 'all' as const
    return activeSeasonNum
  })()

  const allSeasons = useMemo(() => {
    if (!seasons.length) return [] as number[]
    return seasons
      .map(s => s.seasonNum)
      .filter(n => Number.isFinite(n))
      .sort((a, b) => b - a) // más reciente primero
  }, [seasons])

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectSeason = (value: number | 'all') => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.set('season', 'all')
    } else if (value === activeSeasonNum) {
      next.delete('season')
    } else {
      next.set('season', String(value))
    }
    setSearchParams(next)
    setOpen(false)
  }

  const isViewingPast = selectedSeason !== activeSeasonNum
  const label =
    selectedSeason === 'all'
      ? 'Todas las temporadas'
      : selectedSeason === activeSeasonNum
        ? `Temporada actual (#${activeSeasonNum})`
        : `Temporada #${selectedSeason} (archivo)`

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`font-body focus-visible flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
          isViewingPast
            ? 'bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/30'
            : 'bg-bg-elevated/60 text-text-muted hover:text-text-primary'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="8" height="7" rx="1" />
          <path d="M4 1v3M8 1v3M2 6h8" />
        </svg>
        <span>{label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="bg-bg-card border-border-card animate-fade-in-up absolute top-full right-0 left-auto z-30 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border p-1 shadow-lg"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={selectedSeason === activeSeasonNum}
              onClick={() => selectSeason(activeSeasonNum)}
              className={`font-body focus-visible flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                selectedSeason === activeSeasonNum
                  ? 'bg-accent-gold/10 text-accent-gold font-semibold'
                  : 'text-text-primary hover:bg-bg-elevated'
              }`}
            >
              <span>Temporada actual</span>
              <span className="text-text-dim font-mono text-[10px]">#{activeSeasonNum}</span>
            </button>
          </li>
          {allSeasons.length > 0 && (
            <li>
              <div className="bg-border-card/40 my-1 h-px" />
            </li>
          )}
          {allSeasons
            .filter(s => s !== activeSeasonNum)
            .map(s => (
              <li key={s}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedSeason === s}
                  onClick={() => selectSeason(s)}
                  className={`font-body focus-visible flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                    selectedSeason === s
                      ? 'bg-accent-gold/10 text-accent-gold font-semibold'
                      : 'text-text-primary hover:bg-bg-elevated'
                  }`}
                >
                  <span>Temporada #{s}</span>
                  <span className="text-text-dim font-mono text-[10px]">
                    {seasons.find(x => x.seasonNum === s)?.seasonName || ''}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

export function CompetitionPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useParams<{ id: string; tab?: string }>()
  const competitionId = useMemo(() => {
    const id = parseInt(params.id || '', 10)
    return Number.isFinite(id) ? id : null
  }, [params.id])
  const { competitions } = useCompetitions()
  const { setCompetitionId } = useActiveCompetition()

  // Tab: por URL o por defecto 'standings'. Si es inválido, fallback.
  const requestedTab: TabId = isValidTab(params.tab) ? params.tab : 'standings'
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab)

  // Sincronizar el tab cuando cambia el param de URL (back/forward).
  useEffect(() => {
    setActiveTab(requestedTab)
  }, [requestedTab])

  // Mantener el context en sync con la comp activa.
  useEffect(() => {
    if (competitionId != null) setCompetitionId(competitionId)
  }, [competitionId, setCompetitionId])

  const { detail, loading: detailLoading } = useCompetitionDetail(competitionId)
  const { info, loading: infoLoading } = useTournamentInfo(competitionId)

  // Temporada activa del context (la "principal" de active_competitions).
  const activeSeasonNum = useMemo(() => {
    const found = competitions.find(c => c.id === competitionId)
    return found?.seasonNum ?? info?.seasonNum ?? null
  }, [competitions, competitionId, info])

  // Temporada activa para filtrar: ?season=X → X, ?season=all → 'all',
  // por defecto → activeSeasonNum.
  const seasonFilter = useMemo(() => {
    const q = searchParams.get('season')
    if (q === 'all') return 'all' as const
    if (q != null) {
      const n = parseInt(q, 10)
      if (Number.isFinite(n)) return n
    }
    return activeSeasonNum
  }, [searchParams, activeSeasonNum])

  // Tabs visibles.
  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter(t => {
      if (t.requireFlag && detail?.[t.requireFlag] !== true) return false
      if (t.showIf && !t.showIf(detail)) return false
      return true
    })
  }, [detail])

  // Si el tab activo ya no es visible (después de que detail cargó), redirige.
  // Esperar a que detail cargue evita redirigir cuando el detail es null
  // y los tabs con requireFlag/showIf se filtran temporalmente.
  useEffect(() => {
    if (detailLoading) return
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTab)) {
      const first = visibleTabs[0].id
      setActiveTab(first)
      if (competitionId != null) {
        navigate(`/competicion/${competitionId}/${first}`, { replace: true })
      }
    }
  }, [visibleTabs, activeTab, competitionId, navigate, detailLoading])

  if (competitionId == null) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <ErrorState message="Competición inválida" />
      </div>
    )
  }

  if (detailLoading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-12">
        <div className="space-y-3 text-center">
          <div className="bg-bg-elevated skeleton mx-auto h-8 w-72 rounded" />
          <div className="bg-bg-elevated skeleton mx-auto h-4 w-48 rounded" />
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12">
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

  // Pasar seasonNum explícito a los tabs cuando es la temporada actual;
  // pasar 'all' cuando el usuario está viendo archivo histórico.
  const tabSeasonNum: number | 'all' | null = seasonFilter

  const titleText = info?.name || detail.displayName
  const subtitleParts = [
    seasonFilter === 'all'
      ? 'Viendo archivo histórico'
      : seasonFilter !== activeSeasonNum && seasonFilter !== null
        ? `Temporada #${seasonFilter} (archivo)`
        : info?.seasonNum
          ? `Edición ${info.seasonNum}`
          : null,
    info?.countryName || detail.countryName,
    detail.hasGroups && detail.hasBrackets && 'Grupos + Eliminatorias',
    detail.hasGroups && !detail.hasBrackets && 'Fase única',
    detail.hasBrackets && !detail.hasGroups && 'Solo eliminatorias',
  ].filter(Boolean)

  const viewingArchive =
    seasonFilter === 'all' || (seasonFilter !== null && seasonFilter !== activeSeasonNum)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
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

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {activeSeasonNum != null && (
            <SeasonSelector competitionId={competitionId} activeSeasonNum={activeSeasonNum} />
          )}
          <button
            type="button"
            onClick={() => navigate('/competiciones')}
            className="font-body text-text-muted hover:text-accent-gold inline-flex items-center gap-1 text-xs transition-colors"
          >
            ← Ver todas las competiciones
          </button>
        </div>

        {viewingArchive && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent-gold/30 bg-accent-gold/5 px-3 py-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-accent-gold"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="6" />
              <path d="M7 4v3l2 2" />
            </svg>
            <span className="font-body text-accent-gold text-[11px]">
              Estás viendo datos de archivo. La temporada actual es la #{activeSeasonNum}.
            </span>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('season')
                setSearchParams(next)
              }}
              className="font-body text-accent-gold hover:text-accent-gold/70 text-[11px] underline underline-offset-2"
            >
              Volver a la actual
            </button>
          </div>
        )}
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
        {activeTab === 'standings' && (
          <StandingsTab
            competitionId={competitionId}
            seasonNum={tabSeasonNum === 'all' || tabSeasonNum === null ? undefined : tabSeasonNum}
          />
        )}
        {activeTab === 'brackets' && <BracketsTab competitionId={competitionId} />}
        {activeTab === 'transfers' && <TransfersTab competitionId={competitionId} />}
        {activeTab === 'stats' && (
          <StatsTab
            competitionId={competitionId}
            seasonNum={tabSeasonNum === 'all' || tabSeasonNum === null ? undefined : tabSeasonNum}
          />
        )}
        {activeTab === 'history' && <HistoryTab competitionId={competitionId} />}
      </div>
    </div>
  )
}
