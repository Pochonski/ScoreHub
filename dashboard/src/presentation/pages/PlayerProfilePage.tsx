import { useParams, useNavigate } from 'react-router-dom'
import { useAthleteProfile } from '@/presentation/hooks/useAthletes'
import { PlayerProfile } from '@/presentation/components/explorer/PlayerProfile'

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const athleteId = id ? Number(id) : null
  const { athlete, career, trophies, transfers, loading } = useAthleteProfile(athleteId)

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-6">
            <div className="skeleton h-32 w-32 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-8 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
          <div className="skeleton h-20" />
          <div className="skeleton h-40" />
        </div>
      </div>
    )
  }

  if (!athlete) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-text-muted font-body">Jugador no encontrado</p>
        <button
          onClick={() => navigate('/')}
          className="bg-accent-blue/15 text-accent-blue font-body focus-visible mt-4 rounded-lg px-4 py-2 text-sm"
        >
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="text-text-muted hover:text-text-primary font-body focus-visible mb-4 flex items-center gap-1.5 text-sm transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 12L6 8l4-4" />
        </svg>
        Volver
      </button>
      <PlayerProfile athlete={athlete} career={career} trophies={trophies} transfers={transfers} />
    </div>
  )
}
