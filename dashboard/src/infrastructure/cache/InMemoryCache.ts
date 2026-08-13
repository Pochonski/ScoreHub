export type CacheEntry<T> = {
  data: T
  timestamp: number
  ttl: number
}

/**
 * InMemoryCache — LRU (least-recently-used) cache con TTL.
 *
 * Auditoría 2026-Q3 Fase 7.3: antes era FIFO (la entrada más vieja se evictaba
 * aunque se accediera frecuentemente). Ahora LRU: al hacer `get`, la entrada
 * se mueve al final del Map (que preserva insertion order); al evictar se
 * elimina la primera (la menos recientemente usada).
 */
export class InMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize: number

  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }

  set<T>(key: string, data: T, ttl: number = 60000): void {
    // Si la key ya existe, la borramos primero para "refrescar" su posición.
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Evict la menos recientemente usada (primera del Map).
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    // LRU touch: mover al final del Map.
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.data as T
  }

  clear(): void {
    this.cache.clear()
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /** Auditoría 2026-Q3 Fase 8 — número de entradas actuales. */
  size(): number {
    return this.cache.size
  }
}