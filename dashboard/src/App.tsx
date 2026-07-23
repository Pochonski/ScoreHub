import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { PageShell } from '@/presentation/components/layout/PageShell'
import { DashboardPage } from '@/presentation/pages/DashboardPage'
import { HeroSkeleton } from '@/presentation/components/ui/Skeleton'
import { ActiveCompetitionProvider } from '@/presentation/context/ActiveCompetitionContext'

const AnalysisPage = lazy(() =>
  import('@/presentation/pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))
)
const NewsPage = lazy(() => import('@/presentation/pages/NewsPage').then((m) => ({ default: m.NewsPage })))
const CompeticionesPage = lazy(() =>
  import('@/presentation/pages/CompeticionesPage').then((m) => ({ default: m.CompeticionesPage }))
)
const CompetitionPage = lazy(() =>
  import('@/presentation/pages/CompetitionPage').then((m) => ({ default: m.CompetitionPage }))
)
const PlayerProfilePage = lazy(() =>
  import('@/presentation/pages/PlayerProfilePage').then((m) => ({ default: m.PlayerProfilePage }))
)
const TeamDetailPage = lazy(() =>
  import('@/presentation/pages/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage }))
)
const HistoryEditionPage = lazy(() =>
  import('@/presentation/pages/HistoryEditionPage').then((m) => ({ default: m.HistoryEditionPage }))
)
const MatchDetailPage = lazy(() =>
  import('@/presentation/pages/MatchDetailPage').then((m) => ({ default: m.MatchDetailPage }))
)

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
      <HeroSkeleton />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-elevated skeleton h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

const PRIMARY_COMPETITION_ID = parseInt(
  import.meta.env.VITE_PRIMARY_COMPETITION_ID || '5930',
  10
)

export default function App() {
  return (
    <ActiveCompetitionProvider>
      <PageShell>
        <ScrollToTop />
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analisis" element={<AnalysisPage />} />
            <Route path="/noticias" element={<NewsPage />} />
            <Route path="/competiciones" element={<CompeticionesPage />} />
            {/* /competicion (singular, legacy) → redirige a la home de la comp primary */}
            <Route
              path="/competicion"
              element={<Navigate to={`/competicion/${PRIMARY_COMPETITION_ID}/standings`} replace />}
            />
            {/* Multi-comp: /competicion/:id/:tab? */}
            <Route path="/competicion/:id" element={<CompetitionPage />} />
            <Route path="/competicion/:id/:tab" element={<CompetitionPage />} />
            <Route path="/historial/:seasonNum" element={<HistoryEditionPage />} />
            <Route path="/player/:id" element={<PlayerProfilePage />} />
            <Route path="/equipo/:id" element={<TeamDetailPage />} />
            <Route path="/partido/:id" element={<MatchDetailPage />} />
            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </PageShell>
    </ActiveCompetitionProvider>
  )
}
