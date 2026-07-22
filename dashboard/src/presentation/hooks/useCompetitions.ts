import { useState, useEffect, useCallback } from 'react'
import type { Competition, CompetitionDetail } from '@/domain/entities/Competition'
import { DiContainer } from '@/infrastructure/di/DiContainer'
import { logger } from '@/infrastructure/logging/Logger'

export function useCompetitions() {
  const [comps, setComps] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)
      const repo = DiContainer.getInstance().getCompetitionRepository()
      const data = await repo.getCompetitions()
      if (!signal?.aborted) {
        setComps(data)
        logger.debug('Competiciones cargadas', { count: data.length }, 'useCompetitions')
      }
    } catch (e) {
      if (signal?.aborted) return
      const msg = e instanceof Error ? e.message : 'Error al cargar competiciones'
      setError(msg)
      logger.error('Error al cargar competiciones', { error: msg }, 'useCompetitions')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { competitions: comps, loading, error, refetch: () => fetch() }
}

export function useFeaturedCompetitions() {
  const [comps, setComps] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const repo = DiContainer.getInstance().getCompetitionRepository()
      const data = await repo.getFeaturedCompetitions()
      if (!signal?.aborted) setComps(data)
    } catch {
      if (!signal?.aborted) setComps([])
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { competitions: comps, loading, refetch: () => fetch() }
}

export function useCompetitionDetail(id: number | null) {
  const [detail, setDetail] = useState<CompetitionDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async (signal?: AbortSignal) => {
    if (!id) {
      setDetail(null)
      return
    }
    try {
      setLoading(true)
      const repo = DiContainer.getInstance().getCompetitionRepository()
      const data = await repo.getCompetitionById(id)
      if (!signal?.aborted) setDetail(data)
    } catch {
      if (!signal?.aborted) setDetail(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch])

  return { detail, loading, refetch: () => fetch() }
}
