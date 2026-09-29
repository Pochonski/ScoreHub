import type { Game } from '@/domain/entities/Game'
import type { RawGame } from '@/domain/entities/RawGame'
import { mapRawGame } from '@/data/mappers/GameMapper'

/**
 * Normaliza cuotas de campeón (outrights) de formas variadas del upstream a
 * [{label, value}]. Devuelve null si no hay nada mostrable — hoy la tabla
 * suele venir vacía y no queremos sumar otro empty-state.
 */
export function parseOutrights(data: unknown): { label: string; value: string }[] | null {
  const str = (v: unknown): string | null => {
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    return null
  }
  const fromItem = (item: unknown): { label: string; value: string } | null => {
    if (!item || typeof item !== 'object') return null
    const r = item as Record<string, unknown>
    const label = str(r.name) ?? str(r.team) ?? str(r.competitor) ?? str(r.label) ?? null
    const value = str(r.odd) ?? str(r.odds) ?? str(r.price) ?? str(r.percentage) ?? null
    return label && value ? { label, value } : null
  }
  const collect = (v: unknown): { label: string; value: string }[] => {
    if (Array.isArray(v)) return v.map(fromItem).filter((x): x is { label: string; value: string } => x != null)
    if (v && typeof v === 'object') {
      const r = v as Record<string, unknown>
      for (const key of ['outrights', 'selections', 'markets', 'items', 'data']) {
        if (r[key] != null) {
          const found = collect(r[key])
          if (found.length) return found
        }
      }
      const entries = Object.entries(r)
        .map(([k, val]) => {
          const value = str(val)
          return value ? { label: k, value } : null
        })
        .filter((x): x is { label: string; value: string } => x != null)
      // Solo aceptar mapa plano si las claves parecen equipos (evita metadata).
      if (entries.length >= 2 && entries.length <= 40) return entries
    }
    return []
  }
  const out = collect(data)
  return out.length ? out : null
}

/** Mapea RawGame → Game descartando los que no se puedan convertir. */
export function mapRawGames(list: RawGame[]): Game[] {
  const out: Game[] = []
  for (const r of list) {
    try {
      out.push(mapRawGame(r))
    } catch {
      continue
    }
  }
  return out
}
