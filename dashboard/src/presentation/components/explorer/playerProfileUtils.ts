import type { AthleteCareerSeason, AthleteTransfer } from '@/domain/entities/Athlete'

export function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })
  } catch {
    return d
  }
}

export function contractYear(contractUntil?: string): string | null {
  if (!contractUntil) return null
  // Formatos vistos: "01-07-2027 00:00" y "2027-07-01".
  const datePart = contractUntil.split(' ')[0]
  const parts = datePart.split('-')
  if (parts.length === 3) {
    const year = parts[0].length === 4 ? parts[0] : parts[2]
    if (/^\d{4}$/.test(year)) return year
  }
  return null
}

export interface Stint {
  team: string
  badge?: string | null
  label: string
  start: string
  endLabel: string
  contractUntil?: string
}

/**
 * Timeline única por equipos a partir de los traspasos (ordenados del más
 * reciente al más viejo). Agrupa traspasos consecutivos del mismo club y
 * conserva el "Hasta YYYY" del contrato vigente.
 */
export function buildTeamTimeline(transfers: AthleteTransfer[]): Stint[] | null {
  const named = transfers.filter((t) => t.competitorName)
  if (!named.length) return null
  const stints: Stint[] = []
  // Fecha de inicio del stint más nuevo: el stint anterior (más viejo)
  // terminó cuando empezó el siguiente.
  let nextStart: string | null = null
  for (const t of named) {
    const last = stints[stints.length - 1]
    if (last && last.team === t.competitorName) {
      // Entradas consecutivas del mismo club (ej. renovación): el stint
      // empezó antes; se conserva el contrato más reciente.
      last.start = t.date
      continue
    }
    stints.push({
      team: t.competitorName!,
      badge: t.competitorBadge,
      label: t.transferTitle || (stints.length === 0 ? 'Cantera' : 'Traspaso'),
      start: t.date,
      endLabel: nextStart ? formatDate(nextStart) : 'Presente',
      contractUntil: t.contractUntil,
    })
    nextStart = t.date
  }
  return stints
}

/**
 * Las tablas de carrera del upstream tienen forma:
 *   { legend: [{ title }], tables: [{ rows: [{ title, values: [{ value, columnNum }] }] }] }
 * donde `title` de la fila es la competición y `values[i]` corresponde a
 * `legend[i]` por posición. El mapeo anterior esperaba filas planas
 * `{name, value}` y devolvía siempre [] (sección "Estadísticas" vacía).
 */
export function parseCareerTables(
  stats: AthleteCareerSeason['stats']
): { competition: string; stats: { label: string; value: string }[] }[] {
  const tablesRaw = stats?.tables
  if (!Array.isArray(tablesRaw)) return []
  const legend: string[] = []
  const statsObj = stats as { legend?: unknown }
  if (Array.isArray(statsObj.legend)) {
    for (const entry of statsObj.legend) {
      if (entry && typeof entry === 'object' && 'title' in entry && typeof entry.title === 'string') {
        legend.push(entry.title)
      } else {
        legend.push('')
      }
    }
  }
  const out: { competition: string; stats: { label: string; value: string }[] }[] = []
  for (const tbl of tablesRaw) {
    if (!tbl || typeof tbl !== 'object') continue
    const rows = (tbl as { rows?: unknown }).rows
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as { title?: unknown; values?: unknown }
      const competition = typeof r.title === 'string' ? r.title : 'Competición'
      const rowStats: { label: string; value: string }[] = []
      if (Array.isArray(r.values)) {
        r.values.forEach((v, i) => {
          if (!v || typeof v !== 'object') return
          const cell = v as { value?: unknown; columnNum?: unknown }
          const value =
            typeof cell.value === 'string' || typeof cell.value === 'number'
              ? String(cell.value)
              : null
          if (value == null) return
          rowStats.push({ label: legend[i] || `Dato ${i + 1}`, value })
        })
      }
      if (rowStats.length) out.push({ competition, stats: rowStats })
    }
  }
  return out
}

export function isLoanTitle(title?: string): boolean {
  return !!title && /cesi[oó]n|pr[eé]stamo|loan/i.test(title)
}
