import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Athlete } from '@/domain/entities/Athlete'
import type { Team } from '@/domain/entities/Team'
import type { Competition } from '@/domain/entities/Competition'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { ErrorState } from '@/presentation/components/ui/ErrorState'

function useGlobalResults(term: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['global-search', term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const di = DiContainer.getInstance()
      const [athletes, teams, competitions] = await Promise.all([
        di.getAthleteRepository().searchAthletes(term).catch((): Athlete[] => []),
        di.getTeamRepository().searchTeams(term).catch((): Team[] => []),
        di
          .getCompetitionRepository()
          .getCompetitions()
          .catch((): Competition[] => []),
      ])
      const t = term.toLowerCase()
      return {
        athletes: athletes.slice(0, 20),
        teams: teams.slice(0, 20),
        competitions: competitions
          .filter(
            (c) =>
              c.displayName.toLowerCase().includes(t) ||
              c.shortName?.toLowerCase().includes(t)
          )
          .slice(0, 10),
      }
    },
    staleTime: 60 * 1000,
  })
  return {
    results: data ?? { athletes: [], teams: [], competitions: [] },
    loading: isLoading,
  }
}

function ResultSection({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  if (empty) return null
  return (
    <section>
      <h2 className="font-body text-text-dim mb-3 text-[11px] tracking-wider uppercase">{title}</h2>
      <div className="bg-bg-card border-border-card divide-border-card/50 divide-y overflow-hidden rounded-xl border">
        {children}
      </div>
    </section>
  )
}

/**
 * /buscar?q= — resultados completos de la búsqueda global.
 */
export function BuscarPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const term = (searchParams.get('q') || '').trim()
  const { results, loading } = useGlobalResults(term)

  const empty =
    !loading &&
    results.athletes.length === 0 &&
    results.teams.length === 0 &&
    results.competitions.length === 0

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="font-body text-text-muted hover:text-text-primary focus-visible mb-3 flex items-center gap-1.5 text-xs transition-colors"
        >
          ← Volver
        </button>
        <h1 className="font-display text-text-primary text-3xl">
          Resultados para “{term}”
        </h1>
      </div>

      {term.length < 2 ? (
        <p className="font-body text-text-muted text-sm">Escribe al menos 2 letras para buscar.</p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : empty ? (
        <ErrorState message={`Sin resultados para “${term}”`} />
      ) : (
        <>
          <ResultSection title={`Jugadores (${results.athletes.length})`} empty={results.athletes.length === 0}>
            {results.athletes.map((a) => (
              <Link
                key={a.id}
                to={`/player/${a.id}`}
                className="hover:bg-bg-elevated/50 focus-visible block px-4 py-3 transition-colors"
              >
                <p className="font-body text-text-primary text-sm">{a.name}</p>
                {a.position?.name && (
                  <p className="font-body text-text-dim text-[11px]">{a.position.name}</p>
                )}
              </Link>
            ))}
          </ResultSection>
          <ResultSection title={`Equipos (${results.teams.length})`} empty={results.teams.length === 0}>
            {results.teams.map((t) => (
              <Link
                key={t.id}
                to={`/equipo/${t.id}`}
                className="hover:bg-bg-elevated/50 focus-visible block px-4 py-3 transition-colors"
              >
                <p className="font-body text-text-primary text-sm">{t.name}</p>
                {t.shortName && <p className="font-body text-text-dim text-[11px]">{t.shortName}</p>}
              </Link>
            ))}
          </ResultSection>
          <ResultSection
            title={`Competiciones (${results.competitions.length})`}
            empty={results.competitions.length === 0}
          >
            {results.competitions.map((c) => (
              <Link
                key={c.id}
                to={`/competicion/${c.id}/standings`}
                className="hover:bg-bg-elevated/50 focus-visible block px-4 py-3 transition-colors"
              >
                <p className="font-body text-text-primary text-sm">{c.displayName}</p>
                {c.countryName && <p className="font-body text-text-dim text-[11px]">{c.countryName}</p>}
              </Link>
            ))}
          </ResultSection>
        </>
      )}
    </div>
  )
}
