import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { PageShell } from '@/presentation/components/layout/PageShell'
import { DashboardPage } from '@/presentation/pages/DashboardPage'
import { HeroSkeleton } from '@/presentation/components/ui/Skeleton'

const AnalysisPage = lazy(() =>
  import('@/presentation/pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))
)
const CompetitionPage = lazy(() =>
  import('@/presentation/pages/CompetitionPage').then((m) => ({ default: m.CompetitionPage }))
)
const PlayerProfilePage = lazy(() =>
  import('@/presentation/pages/PlayerProfilePage').then((m) => ({ default: m.PlayerProfilePage }))
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

export default function App() {
  return (
    <PageShell>
      <ScrollToTop />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/analisis" element={<AnalysisPage />} />
          <Route path="/competicion" element={<CompetitionPage />} />
          <Route path="/historial/:seasonNum" element={<HistoryEditionPage />} />
          <Route path="/player/:id" element={<PlayerProfilePage />} />
          <Route path="/partido/:id" element={<MatchDetailPage />} />
        </Routes>
      </Suspense>
    </PageShell>
  )
}
