import { describe, it, expect, beforeEach } from 'vitest'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import ErrorHandler from '@/infrastructure/errors/ErrorHandler'
import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'
import { DateUtils, ArrayUtils, StringUtils, AsyncUtils } from '@/shared/utils'

describe('DateUtils', () => {
  it('formatea fechas correctamente', () => {
    const result = DateUtils.formatDate('2024-01-15T10:30:00Z')
    expect(typeof result).toBe('string')
    expect(result).toContain('15')
  })

  it('devuelve cadena vacía para fechas inválidas', () => {
    const result = DateUtils.formatDate('invalid-date')
    expect(result).toBe('')
  })
})

describe('ArrayUtils', () => {
  it('agrupa elementos', () => {
    const items = [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
      { category: 'A', value: 3 },
    ]
    const grouped = ArrayUtils.groupBy(items, (item) => item.category)
    expect(grouped.get('A')).toHaveLength(2)
    expect(grouped.get('B')).toHaveLength(1)
  })
})

describe('StringUtils', () => {
  it('capitaliza cadenas', () => {
    expect(StringUtils.capitalize('hello')).toBe('Hello')
    expect(StringUtils.capitalize('WORLD')).toBe('World')
  })
})

describe('AppError', () => {
  it('crea error con código y estado', () => {
    const error = new AppError('test message', ErrorCode.NETWORK_ERROR, 500)
    expect(error.message).toBe('test message')
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR)
    expect(error.status).toBe(500)
    expect(error.name).toBe('AppError')
  })
})

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance({ logErrors: false })
  })

  it('maneja errores nativos de JavaScript', () => {
    const result = errorHandler.handle(new Error('native error'))
    expect(result.message).toBe('native error')
  })
})

describe('DiContainer', () => {
  it('retorna instancia singleton', () => {
    const container1 = DiContainer.getInstance()
    const container2 = DiContainer.getInstance()
    expect(container1).toBe(container2)
  })

  it('provee repositorios correctamente', () => {
    const container = DiContainer.getInstance()
    expect(container.getGameRepository()).toBeDefined()
    expect(container.getNewsRepository()).toBeDefined()
    expect(container.getTournamentStatsRepository()).toBeDefined()
    expect(container.getBettingTipRepository()).toBeDefined()
    expect(container.getAthleteRepository()).toBeDefined()
    expect(container.getTeamRepository()).toBeDefined()
    expect(container.getHistoryRepository()).toBeDefined()
    expect(container.getTournamentInfoRepository()).toBeDefined()
    expect(container.getStandingRepository()).toBeDefined()
  })
})
