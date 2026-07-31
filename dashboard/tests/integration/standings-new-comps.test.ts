/**
 * tests/integration/standings-new-comps.test.ts — Fase 8.7+
 *
 * Verifica que los endpoints /standings y /standings/seasons
 * retornan datos correctos para las 6 nuevas competiciones
 * añadidas en Fase 8.6+ (Eurocopa, CopaAm, CONCACAF Centro)
 * y Fase 8.7+ (Liga MX, MLS, Liga Argentina).
 *
 * Los datos son verificados contra la API en producción:
 * https://scorehub-pocho.vercel.app
 *
 * Si los tests fallan, puede ser que la API haya cambiado.
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = 'https://scorehub-pocho.vercel.app/api/football'

// 6 nuevas competiciones (3 de Fase 8.6+ + 3 de Fase 8.7+)
const NEW_COMPS = [
  { id: 141, name: 'Liga MX', shortName: 'Liga MX', expectedSeason: 152, expectedDisplayOrder: 11 },
  { id: 104, name: 'MLS', shortName: 'MLS', expectedSeason: 32, expectedDisplayOrder: 9 },
  { id: 72, name: 'Liga Profesional Argentina', shortName: 'Liga Argentina', expectedSeason: 228, expectedDisplayOrder: 7 },
  { id: 595, name: 'Copa América', shortName: 'Copa América', expectedSeason: 52, expectedDisplayOrder: 6 },
  { id: 6316, name: 'Eurocopa', shortName: 'Eurocopa', expectedSeason: 17, expectedDisplayOrder: 5 },
  { id: 7954, name: 'CONCACAF Copa Centroamericana', shortName: 'Concacaf Centroamericana', expectedSeason: 4, expectedDisplayOrder: 8 },
]

interface StandingGroup {
  name: string
  displayName?: string
  isCurrentStage?: boolean
  rows: Array<{
    position: number
    team: { id: number; name: string }
    played: number
    won: number
    draw: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    points: number
  }>
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}`)
  }
  return res.json() as Promise<T>
}

describe('integration/standings-new-comps — endpoints de standings', () => {
  beforeAll(() => {
    // Las pruebas hacen fetch real a producción
    if (!navigator.onLine) {
      throw new Error('No hay conexión a internet')
    }
  })

  describe.each(NEW_COMPS)(
    '$name (id=$id)',
    ({ id, name, expectedSeason, expectedDisplayOrder }) => {
      it('GET /standings?competitionId=X retorna 200 con groups', async () => {
        const groups = await fetchJson<StandingGroup[]>(
          `${BASE_URL}/standings?competitionId=${id}`,
        )
        expect(groups.length).toBeGreaterThan(0)
        for (const g of groups) {
          expect(g.rows.length).toBeGreaterThan(0)
        }
      }, 15000)

      it('GET /standings/seasons?competitionId=X retorna 200 con seasons', async () => {
        // El response usa seasonNum (camelCase) según el backend
        const seasons = await fetchJson<Array<{ seasonNum: number; seasonName: string }>>(
          `${BASE_URL}/standings/seasons?competitionId=${id}`,
        )
        expect(seasons.length).toBeGreaterThan(0)
        const hasCurrent = seasons.some(s => s.seasonNum === expectedSeason)
        expect(hasCurrent, `Season ${expectedSeason} should be in the list`).toBe(true)
      }, 15000)

      it('GET /competitions/X retorna el detail correcto', async () => {
        const detail = await fetchJson<{
          id: number
          displayName: string
          seasonNum: number
          hasBrackets: boolean
          hasGroups: boolean
          hasHistory: boolean
          displayOrder: number | string
        }>(`${BASE_URL}/competitions/${id}`)
        expect(detail.id).toBe(id)
        expect(detail.displayName).toContain(name)
        expect(detail.seasonNum).toBe(expectedSeason)
        expect(detail.hasHistory).toBe(true)
        expect(Number(detail.displayOrder)).toBe(expectedDisplayOrder)
      }, 15000)
    },
  )

  it('GET /competitions retorna 13 competiciones incluyendo las 6 nuevas', async () => {
    const comps = await fetchJson<Array<{ id: number; displayName: string }>>(
      `${BASE_URL}/competitions`,
    )
    expect(comps.length).toBe(13)
    for (const { id, name } of NEW_COMPS) {
      const found = comps.find(c => c.id === id)
      expect(found, `Comp ${id} (${name}) should be in the list`).toBeDefined()
      expect(found?.displayName).toBeTruthy()
    }
  }, 15000)
})