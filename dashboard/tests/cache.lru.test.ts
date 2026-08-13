/**
 * tests/cache.lru.test.ts — Auditoría 2026-Q3 Fase 7.3
 *
 * Tests del comportamiento LRU del InMemoryCache.
 */
import { describe, it, expect } from 'vitest';
import { InMemoryCache } from '@/infrastructure/cache/InMemoryCache';

describe('InMemoryCache — LRU eviction', () => {
  it('evicts la entrada menos recientemente usada cuando se llena', () => {
    const cache = new InMemoryCache(3);
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.set('c', 3, 60000);
    // Llenamos el cache. Ahora insertamos 'd' → debe evictar 'a' (LRU).
    cache.set('d', 4, 60000);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('get() refresca la posición LRU de la entrada accedida', () => {
    const cache = new InMemoryCache(3);
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.set('c', 3, 60000);
    // Acceder a 'a' lo convierte en MRU; ahora 'b' es el LRU.
    expect(cache.get('a')).toBe(1);
    cache.set('d', 4, 60000);
    // 'b' debe ser evictado, no 'a'.
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('set() sobre key existente actualiza su posición sin evictar', () => {
    const cache = new InMemoryCache(2);
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.set('a', 99, 60000); // re-set 'a', ahora es MRU
    cache.set('c', 3, 60000); // debe evictar 'b'
    expect(cache.get('a')).toBe(99);
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBe(3);
  });

  it('TTL expiry remueve la entrada', async () => {
    const cache = new InMemoryCache(10);
    cache.set('a', 1, 10); // 10ms TTL
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get('a')).toBeNull();
  });

  it('size() retorna el número de entradas', () => {
    const cache = new InMemoryCache(10);
    expect(cache.size()).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size()).toBe(2);
  });

  it('clear() vacía el cache', () => {
    const cache = new InMemoryCache(10);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('a')).toBeNull();
  });
});