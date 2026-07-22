import { useParams, useNavigate } from 'react-router-dom'
import { useAthleteProfile } from '@/presentation/hooks/useAthletes'
import { PlayerProfile } from '@/presentation/components/explorer/PlayerProfile'

type ErrorState = ReturnType<typeof useAthleteProfile>['error']

function errorTitle(err: ErrorState): string {
  if (!err) return 'Algo salió mal'
  switch (err.kind) {
    case 'not_found':
      return 'Jugador no encontrado'
    case 'invalid_id':
      return 'ID de jugador inválido'
    case 'rate_limited':
      return 'Demasiadas solicitudes'
    case 'server_error':
      return 'El servidor tuvo un problema'
    case 'network':
      return 'Sin conexión'
    case 'timeout':
      return 'La solicitud tardó demasiado'
    default:
      return 'Algo salió mal'
  }
}

function errorMessage(err: ErrorState): string {
  if (!err) return 'Intenta de nuevo en unos segundos.'
  switch (err.kind) {
    case 'not_found':
      return 'Verifica que el enlace sea correcto o busca al jugador desde el inicio.'
    case 'invalid_id':
      return 'El identificador del jugador no es válido.'
    case 'rate_limited':
      return 'Has hecho muchas solicitudes. Espera un minuto e intenta de nuevo.'
    case 'server_error':
      return 'Nuestro servidor tuvo un problema. Intenta de nuevo en unos segundos.'
    case 'network':
      return 'Revisa tu conexión a internet.'
    case 'timeout':
      return 'La respuesta tardó demasiado. Intenta de nuevo.'
    default:
      return err.message || 'Intenta de nuevo en unos segundos.'
  }
}

function canRetry(err: ErrorState): boolean {
  if (!err) return true
  return err.kind !== 'not_found' && err.kind !== 'invalid_id'
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const athleteId = id ? Number(id) : null
  const { athlete, career, trophies, transfers, loading, error, refetch } = useAthleteProfile(athleteId)

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

  if (error && !athlete) {
    const showRetry = canRetry(error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="font-display text-text-primary text-xl font-semibold">{errorTitle(error)}</h1>
        <p className="font-body text-text-muted mt-2 text-sm">{errorMessage(error)}</p>
        <div className="mt-4 flex justify-center gap-2">
          {showRetry && (
            <button
              onClick={() => refetch()}
              className="bg-accent-blue/15 text-accent-blue font-body focus-visible rounded-lg px-4 py-2 text-sm"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="bg-bg-elevated text-text-muted font-body focus-visible rounded-lg px-4 py-2 text-sm"
          >
            Volver al inicio
          </button>
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

  const hasPartialError = !!error && !!(career.length === 0 && trophies.length === 0 && transfers.length === 0)

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
      <PlayerProfile
        athlete={athlete}
        career={career}
        trophies={trophies}
        transfers={transfers}
        partialData={hasPartialError}
      />
    </div>
  )
}