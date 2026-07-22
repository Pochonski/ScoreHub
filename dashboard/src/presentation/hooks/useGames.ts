import { useState, useEffect, useCallback } from 'react'
import type { Game } from '@/domain/entities/Game'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { logger } from '@/infrastructure/logging/Logger'
import type { GetGamesParams } from '@/domain/repositories/GameRepository'

export function useGames(params?: GetGamesParams) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        setError(null)
        const gameRepo = DiContainer.getInstance().getGameRepository()
        const data = await gameRepo.getGames(params)
        if (!signal?.aborted) {
          setGames(data)
          logger.debug(
            'Partidos cargados',
            { count: data.length, competitionId: params?.competitionId, all: params?.all },
            'useGames'
          )
        }
      } catch (e) {
        if (signal?.aborted) return
        const msg = e instanceof Error ? e.message : 'Error al cargar partidos'
        const stack = e instanceof Error ? e.stack : undefined
        const appCode = (e as { code?: string })?.code
        setError(msg)
        logger.error('Error al cargar partidos', { error: msg, code: appCode, stack, params }, 'useGames')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [params?.statusGroup, params?.stage, params?.teamId, params?.competitionId, params?.all]
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { games, loading, error, refetch: () => fetch() }
}

export function useLiveGames(params?: { competitionId?: number; all?: boolean }) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null)
      const gameRepo = DiContainer.getInstance().getGameRepository()
      const data = await gameRepo.getLiveGames(params)
      if (!signal?.aborted) {
        setGames(data)
        logger.debug(
          'Partidos en vivo cargados',
          { count: data.length, competitionId: params?.competitionId, all: params?.all },
          'useLiveGames'
        )
      }
    } catch (e) {
      if (signal?.aborted) return
      const msg = e instanceof Error ? e.message : 'Error al cargar partidos en vivo'
      setError(msg)
      logger.error('Error al cargar partidos en vivo', { error: msg }, 'useLiveGames')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [params?.competitionId, params?.all])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { games, loading, error, refetch: () => fetch() }
}

export function useFeaturedGame(competitionId?: number | null) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const gameRepo = DiContainer.getInstance().getGameRepository()
      const data = await gameRepo.getFeaturedGame(competitionId ?? undefined)
      if (!signal?.aborted) {
        setGame(data)
        logger.debug('Partido destacado cargado', { hasData: !!data, competitionId }, 'useFeaturedGame')
      }
    } catch (e) {
      if (signal?.aborted) return
      const msg = e instanceof Error ? e.message : 'Error al cargar partido destacado'
      const stack = e instanceof Error ? e.stack : undefined
      const appCode = (e as { code?: string })?.code
      logger.error(
        'Error al cargar partido destacado',
        { error: msg, code: appCode, stack },
        'useFeaturedGame'
      )
      setGame(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [competitionId])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { game, loading, refetch: () => fetch() }
}
