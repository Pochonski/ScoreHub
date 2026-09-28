import { describe, it, expect } from 'vitest'
import { playerLine, parseFormation, orderPlayersByLine } from './TeamOfWeekPitch'

describe('playerLine', () => {
  it('clasifica posiciones en español del upstream', () => {
    expect(playerLine('Portero')).toBe(0)
    expect(playerLine('Defensor')).toBe(1)
    expect(playerLine('Mediocampista')).toBe(2)
    expect(playerLine('Delantero')).toBe(3)
  })

  it('acepta variantes en inglés', () => {
    expect(playerLine('Goalkeeper')).toBe(0)
    expect(playerLine('Centre-back')).toBe(1)
    expect(playerLine('Midfielder')).toBe(2)
    expect(playerLine('Winger')).toBe(3)
  })

  it('excluye cuerpo técnico', () => {
    expect(playerLine('Dirección')).toBe(-1)
    expect(playerLine('Entrenador')).toBe(-1)
    expect(playerLine('Coach')).toBe(-1)
  })

  it('manda lo desconocido al final (no lo excluye)', () => {
    expect(playerLine('???')).toBe(4)
    expect(playerLine(null)).toBe(4)
  })
})

describe('parseFormation', () => {
  it('parsea formaciones compuestas', () => {
    expect(parseFormation('4-3-3')).toEqual([1, 4, 3, 3])
    expect(parseFormation('4-2-3-1')).toEqual([1, 4, 2, 3, 1])
    expect(parseFormation('3-5-2')).toEqual([1, 3, 5, 2])
  })

  it('cae a 4-4-2 con input inválido', () => {
    expect(parseFormation('')).toEqual([1, 4, 4, 2])
    expect(parseFormation('bananas')).toEqual([1, 4, 4, 2])
    expect(parseFormation('1-1')).toEqual([1, 4, 4, 2])
  })
})

describe('orderPlayersByLine', () => {
  it('ordena portero → defensa → medio → delantero aunque vengan revueltos', () => {
    const players = [
      { name: 'Eriksen', position: 'Mediocampista', rating: 8.0 },
      { name: 'Raya', position: 'Portero', rating: 7.5 },
      { name: 'Gakpo', position: 'Delantero', rating: 8.5 },
      { name: 'Grimaldo', position: 'Defensor', rating: 7.0 },
      { name: 'DT', position: 'Dirección', rating: 10 },
    ]
    const ordered = orderPlayersByLine(players).map((p) => p.name)
    expect(ordered).toEqual(['Raya', 'Grimaldo', 'Eriksen', 'Gakpo'])
  })

  it('ordena por rating desc dentro de la misma línea', () => {
    const players = [
      { name: 'Bajo', position: 'Delantero', rating: 6.5 },
      { name: 'Alto', position: 'Delantero', rating: 9.0 },
    ]
    expect(orderPlayersByLine(players).map((p) => p.name)).toEqual(['Alto', 'Bajo'])
  })
})
