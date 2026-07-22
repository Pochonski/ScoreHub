import { useHistoryStats } from '@/presentation/hooks/useHistoryStats'

export function HistoryStatsBanner({ competitionId }: { competitionId?: number }) {
  const { stats, loading } = useHistoryStats(competitionId)

  if (loading) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-card skeleton h-8 w-36 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="font-body bg-bg-card text-text-muted inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium">
        {stats.totalEditions} ediciones
      </span>
    </div>
  )
}
