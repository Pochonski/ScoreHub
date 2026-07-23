import { Link } from 'react-router-dom'
import type { Game } from '@/domain/entities/Game'
import { MatchCard } from './MatchCard'

interface MatchGridProps {
  games: Game[]
  onSelect?: (game: Game) => void
  featuredId?: number
  emptyMessage?: string
  /** Nombre de la competición que se muestra en cada cabecera de fecha. */
  competitionName?: string
  /** ID de la competición — habilita el link "→" hacia la página de info. */
  competitionId?: number
  /**
   * Orden de los grupos por fecha:
   *   - 'asc'  → más antiguos primero (default; cronológico de temporada)
   *   - 'desc' → más recientes primero (útil para "último partido")
   */
  dateOrder?: 'asc' | 'desc'
}

function groupByDate(
  games: Game[],
  dateOrder: 'asc' | 'desc'
): { date: string; label: string; labelUpper: string; games: Game[] }[] {
  const groups = new Map<string, Game[]>()

  games.forEach((game) => {
    const dateKey = game.startTime ? new Date(game.startTime).toDateString() : 'unknown'
    if (!groups.has(dateKey)) groups.set(dateKey, [])
    groups.get(dateKey)!.push(game)
  })

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === 'unknown') return -1
      if (b === 'unknown') return 1
      const diff = new Date(a).getTime() - new Date(b).getTime()
      return dateOrder === 'desc' ? -diff : diff
    })
    .map(([dateKey, games]) => ({
      date: dateKey,
      label: formatGroupLabel(dateKey),
      labelUpper: formatGroupLabelUpper(dateKey),
      // Dentro de una jornada, ordenar por hora de inicio (ASC) — el primer
      // partido del día aparece arriba.
      games: games.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    }))
}

function formatGroupLabel(dateKey: string): string {
  if (dateKey === 'unknown') return 'Sin fecha'
  const today = new Date().toDateString()
  const tomorrow = new Date(Date.now() + 86400000).toDateString()
  if (dateKey === today) return 'Hoy'
  if (dateKey === tomorrow) return 'Mañana'
  const d = new Date(dateKey)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatGroupLabelUpper(dateKey: string): string {
  if (dateKey === 'unknown') return 'SIN FECHA'
  const today = new Date().toDateString()
  const tomorrow = new Date(Date.now() + 86400000).toDateString()
  if (dateKey === today) return 'HOY'
  if (dateKey === tomorrow) return 'MAÑANA'
  const d = new Date(dateKey)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}

export function MatchGrid({
  games,
  onSelect,
  featuredId,
  emptyMessage,
  competitionName,
  competitionId,
  dateOrder = 'asc',
}: MatchGridProps) {
  if (games.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-muted font-body text-sm">{emptyMessage || 'No hay partidos para mostrar'}</p>
      </div>
    )
  }

  const groups = groupByDate(games, dateOrder)
  const headerName = competitionName || 'Partidos'
  // Link "→" hacia la página de info de la competición. Para la opción
  // "Todas" dejamos el link hacia /competiciones (índice).
  const compInfoHref = competitionId
    ? `/competicion/${competitionId}/standings`
    : '/competiciones'

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <div key={group.date}>
          {/* Premium date header */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="via-border-card h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
              <span className="text-text-dim font-mono text-[10px] tracking-[0.2em] uppercase">
                {group.labelUpper}
              </span>
              <div className="via-border-card h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
            </div>
            <Link
              to={compInfoHref}
              className="group block text-center"
              aria-label={`Ver información de ${headerName}`}
            >
              <h2 className="font-display text-accent-gold/90 group-hover:text-accent-gold text-xl font-bold tracking-wide transition-colors sm:text-2xl">
                {headerName}
                <span className="text-accent-gold/50 group-hover:text-accent-gold ml-2 inline-block transition-all group-hover:translate-x-0.5">
                  →
                </span>
              </h2>
            </Link>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="font-body text-text-dim text-[11px]">
                {group.games.length} partido{group.games.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.games.map((game, index) => (
              <div
                key={game.id}
                className={`card-enter transition-all duration-200 ${
                  game.id === featuredId ? 'ring-accent-gold/30 scale-[1.02] rounded-xl ring-2' : ''
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <MatchCard game={game} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
