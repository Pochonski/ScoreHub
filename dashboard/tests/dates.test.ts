import { describe, it, expect } from 'vitest'
import { formatDate, formatTime, formatShortDate, formatShortTime } from '@/presentation/utils/dates'

describe('dates utils', () => {
  describe('formatDate', () => {
    it('formatea una fecha ISO', () => {
      const result = formatDate('2026-06-15T18:00:00Z')
      expect(result).toContain('2026')
      expect(result).toContain('15')
    })

    it('devuelve string vacío para fecha vacía', () => {
      expect(formatDate('')).toBe('')
    })

    it('devuelve string vacío para fecha inválida', () => {
      expect(formatDate('invalid')).toBe('')
    })
  })

  describe('formatTime', () => {
    it('formatea una hora ISO', () => {
      const result = formatTime('2026-06-15T18:30:00Z')
      expect(result).toMatch(/\d{2}:\d{2}/)
    })

    it('devuelve string vacío para fecha vacía', () => {
      expect(formatTime('')).toBe('')
    })
  })

  describe('formatShortDate', () => {
    it('devuelve "Hoy" para fecha actual', () => {
      expect(formatShortDate(new Date().toISOString())).toBe('Hoy')
    })

    it('devuelve "Mañana" para fecha de mañana', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(formatShortDate(tomorrow.toISOString())).toBe('Mañana')
    })

    it('formatea fecha lejana como día y mes', () => {
      const result = formatShortDate('2026-12-25T00:00:00Z')
      expect(result).not.toBe('Hoy')
      expect(result).not.toBe('Mañana')
      expect(result.length).toBeGreaterThan(0)
    })

    it('devuelve string vacío para fecha inválida', () => {
      expect(formatShortDate('invalid')).toBe('')
    })
  })

  describe('formatShortTime', () => {
    it('formatea hora corta', () => {
      expect(formatShortTime('2026-06-15T18:45:00Z')).toMatch(/\d{2}:\d{2}/)
    })

    it('devuelve string vacío para entrada inválida', () => {
      expect(formatShortTime('')).toBe('')
      expect(formatShortTime('invalid')).toBe('')
    })
  })
})
