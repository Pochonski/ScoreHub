import type { Athlete } from '@/domain/entities/Athlete'
import { AthleteSchema } from '@/infrastructure/validation/schemas'

export function mapAthlete(raw: Record<string, unknown>): Athlete {
  const parsed = AthleteSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      id: raw.id as number,
      name: (raw.name as string) || '',
      shortName: raw.shortName as string,
    }
  }
  return parsed.data
}

export function mapAthletes(raw: Record<string, unknown>[]): Athlete[] {
  return raw.map(mapAthlete)
}
