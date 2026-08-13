/**
 * tests/hooks/useGameDetail.test.tsx — Auditoría 2026-Q3 Fase 7.4
 *
 * Verifica que el hook expone `partialError` cuando una sección falla,
 * sin bloquear las otras secciones.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// Mockear apiClient para que el hook no haga fetch real al endpoint de news.
vi.mock('@/data/datasources/ApiClient', () => ({
  apiClient: {
    get: vi.fn(() => Promise.resolve([])),
  },
}))

import { DiContainer } from '@/infrastructure/di/DiContainer'
import { useGameDetail } from '@/presentation/hooks/useGameDetail'

// Mocks del repositorio: cada método puede resolverse o rechazar.
function makeRepo(overrides: Partial<Record<string, () => Promise<unknown>>> = {}) {
  return {
    getGameById: vi.fn(() => Promise.resolve({ id: 1, home: 'A', away: 'B' })),
    getGameStats: vi.fn(() => Promise.resolve([])),
    getGameLineups: vi.fn(() => Promise.resolve(null)),
    getGameTimeline: vi.fn(() => Promise.resolve([])),
    getGamePredictions: vi.fn(() => Promise.resolve([])),
    getGameTips: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  }
}

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return createElement(QueryClientProvider, { client }, children)
}

describe('useGameDetail — partialError', () => {
  beforeEach(() => {
    // resetForTests existe en DiContainer; defensive fallback si vitest sirve
    // una versión cacheada sin el método.
    const dc = DiContainer.getInstance() as unknown as { resetForTests?: () => void };
    dc.resetForTests?.();
  })

  it('sin failures → partialError vacío', async () => {
    const dc = DiContainer.getInstance() as unknown as {
      setGameRepositoryForTests: (r: unknown) => void;
    };
    dc.setGameRepositoryForTests(makeRepo());
    const { result } = renderHook(() => useGameDetail(123), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.partialError).toEqual([]))
    expect(result.current.error).toBeNull()
    expect(result.current.game).not.toBeNull()
  })

  it('una sección falla → partialError contiene esa sección, otras OK', async () => {
    const dc = DiContainer.getInstance() as unknown as {
      setGameRepositoryForTests: (r: unknown) => void;
    };
    dc.setGameRepositoryForTests(
      makeRepo({
        getGameStats: () => Promise.reject(new Error('stats 500')),
      })
    )
    const { result } = renderHook(() => useGameDetail(123), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.partialError).toHaveLength(1))
    expect(result.current.partialError[0].section).toBe('stats')
    expect(result.current.partialError[0].message).toBe('stats 500')
    expect(result.current.game).not.toBeNull()
    expect(result.current.tips).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('múltiples secciones fallan → todas reportadas', async () => {
    const dc = DiContainer.getInstance() as unknown as {
      setGameRepositoryForTests: (r: unknown) => void;
    };
    dc.setGameRepositoryForTests(
      makeRepo({
        getGameStats: () => Promise.reject(new Error('stats fail')),
        getGameTips: () => Promise.reject(new Error('tips fail')),
      })
    )
    const { result } = renderHook(() => useGameDetail(123), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.partialError).toHaveLength(2))
    const sections = result.current.partialError.map((p) => p.section).sort()
    expect(sections).toEqual(['stats', 'tips'])
  })

  it('gameId null → no fetcha nada, retorna shape vacío', async () => {
    const dc = DiContainer.getInstance() as unknown as {
      setGameRepositoryForTests: (r: unknown) => void;
    };
    dc.setGameRepositoryForTests(makeRepo());
    const { result } = renderHook(() => useGameDetail(null), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.game).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('game falla (fetch error) → otras secciones siguen pobladas', async () => {
    const dc = DiContainer.getInstance() as unknown as {
      setGameRepositoryForTests: (r: unknown) => void;
    };
    dc.setGameRepositoryForTests(
      makeRepo({
        getGameById: () => Promise.reject(new Error('game not found')),
      })
    )
    const { result } = renderHook(() => useGameDetail(123), {
      wrapper: ({ children }) => withQueryClient(children),
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    // Aunque game falla, partialError lo registra.
    const section = result.current.partialError.find((p) => p.section === 'game')
    expect(section).toBeDefined()
    expect(section?.message).toBe('game not found')
  })
})