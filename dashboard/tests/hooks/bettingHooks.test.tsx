import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const { mockGetTrends, mockApiGet } = vi.hoisted(() => ({
  mockGetTrends: vi.fn(),
  mockApiGet: vi.fn(),
}))

vi.mock('@/infrastructure/di/DiContainer', () => ({
  DiContainer: {
    getInstance: () => ({
      getBettingTipRepository: () => ({ getCompetitionTrends: mockGetTrends }),
    }),
  },
}))
vi.mock('@/data/datasources/ApiClient', () => ({ apiClient: { get: mockApiGet } }))

import { useTrends } from '@/presentation/hooks/useTrends'
import { useMatchTipsForGames } from '@/presentation/hooks/useMatchTips'

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  mockGetTrends.mockReset()
  mockApiGet.mockReset()
})

describe('useTrends', () => {
  it('devuelve las tendencias del repo y llama con el competitionId', async () => {
    mockGetTrends.mockResolvedValue([{ betCTA: 'Over 2.5', percentage: 0.8 }])
    const { result } = renderHook(() => useTrends(5930), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trends).toHaveLength(1)
    expect(mockGetTrends).toHaveBeenCalledWith(5930)
  })

  it('trends default a [] antes de cargar', () => {
    mockGetTrends.mockResolvedValue([])
    const { result } = renderHook(() => useTrends(5930), { wrapper: wrapper() })
    expect(result.current.trends).toEqual([])
  })
})

describe('useMatchTipsForGames', () => {
  it('mapea cada gameId a su tip en un Map', async () => {
    mockApiGet.mockImplementation((url: string) => Promise.resolve({ url }))
    const { result } = renderHook(() => useMatchTipsForGames([101, 102]), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tipsByGame.size).toBe(2)
    expect(String(result.current.tipsByGame.get(101)?.url)).toContain('101')
    expect(String(result.current.tipsByGame.get(102)?.url)).toContain('102')
  })

  it('lista vacía → Map vacío, no loading', () => {
    const { result } = renderHook(() => useMatchTipsForGames([]), { wrapper: wrapper() })
    expect(result.current.tipsByGame.size).toBe(0)
    expect(result.current.loading).toBe(false)
  })
})
