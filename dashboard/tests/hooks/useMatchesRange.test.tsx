import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { apiClient } from '@/data/datasources/ApiClient'
import { useMatchesRange, offsetToISODate } from '@/presentation/hooks/useMatchesRange'

vi.mock('@/data/datasources/ApiClient', () => ({
  apiClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(apiClient.get)

function wrapper(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

describe('offsetToISODate', () => {
  it('devuelve hoy en YYYY-MM-DD para offset 0', () => {
    const now = new Date()
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(offsetToISODate(0)).toBe(iso)
  })
})

describe('useMatchesRange', () => {
  it('pide el rango del día con competitionId y mapea a Game', async () => {
    mockedGet.mockResolvedValue([
      {
        id: 4672362,
        competitionId: 7016,
        statusGroup: 3,
        status: 'live',
        startTime: '2026-09-29T10:00:00-06:00',
        statusText: 'Primer Tiempo',
        homeTeam: { id: 5031, name: 'Moldavia', score: 0 },
        awayTeam: { id: 5058, name: 'Islas Feroe', score: 1 },
      },
    ])
    const { result } = renderHook(() => useMatchesRange({ day: '2026-09-29', competitionId: 7016 }), {
      wrapper: ({ children }) => wrapper(children),
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/matches/range', {
      params: { startDate: '2026-09-29', endDate: '2026-09-29', competitionId: '7016' },
    })
    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].status).toBe('live')
    expect(result.current.games[0].homeTeam.name).toBe('Moldavia')
  })

  it('no fetchea sin día', () => {
    mockedGet.mockClear()
    const { result } = renderHook(() => useMatchesRange({ day: null, competitionId: 7016 }), {
      wrapper: ({ children }) => wrapper(children),
    })
    expect(result.current.games).toEqual([])
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
