import { useState, useEffect, useCallback } from 'react'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { logger } from '@/infrastructure/logging/Logger'

export function useGames(params?: { statusGroup?: string; stage?: string; teamId?: string }) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        setError(null)
        const gameRepo = DiContainer.getInstance().getGameRepository()
        const data = await gameRepo.getGames(params)
        if (!signal?.aborted) {
          setGames(data)
          logger.debug('Partidos cargados', { count: data.length, params }, 'useGames')
        }
      } catch (e) {
        if (signal?.aborted) return
        const msg = e instanceof Error ? e.message : 'Error al cargar partidos'
        setError(msg)
        logger.error('Error al cargar partidos', { error: msg, params }, 'useGames')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [params?.statusGroup, params?.stage, params?.teamId]
  )

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { games, loading, error, refetch: () => fetch() }
}

export function useLiveGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null)
      const gameRepo = DiContainer.getInstance().getGameRepository()
      const data = await gameRepo.getLiveGames()
      if (!signal?.aborted) {
        setGames(data)
        logger.debug('Partidos en vivo cargados', { count: data.length }, 'useLiveGames')
      }
    } catch (e) {
      if (signal?.aborted) return
      const msg = e instanceof Error ? e.message : 'Error al cargar partidos en vivo'
      setError(msg)
      logger.error('Error al cargar partidos en vivo', { error: msg }, 'useLiveGames')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { games, loading, error, refetch: () => fetch() }
}

export function useFeaturedGame() {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const gameRepo = DiContainer.getInstance().getGameRepository()
      const data = await gameRepo.getFeaturedGame()
      if (!signal?.aborted) {
        setGame(data)
        logger.debug('Partido destacado cargado', { hasData: !!data }, 'useFeaturedGame')
      }
    } catch (e) {
      if (signal?.aborted) return
      const msg = e instanceof Error ? e.message : 'Error al cargar partido destacado'
      logger.error('Error al cargar partido destacado', { error: msg }, 'useFeaturedGame')
      setGame(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { game, loading, refetch: () => fetch() }
}
