const path = require('path');
const scores365 = require(path.join(__dirname, '..', '..', '..', 'services', 'scores365Service'));

class CacheService {
  constructor(defaultTTL = 300000) {
    this.cache = new Map()
    this.pending = new Map()
    this.ttl = defaultTTL
  }

  async getOrFetch(key, fetcher, ttl = this.ttl) {
    const now = Date.now()
    const entry = this.cache.get(key)
    if (entry && now - entry.at < ttl) return entry.value

    if (this.pending.has(key)) return this.pending.get(key)

    const promise = fetcher().then(value => {
      this.cache.set(key, { value, at: Date.now() })
      this.pending.delete(key)
      return value
    }).catch(err => {
      this.pending.delete(key)
      throw err
    })

    this.pending.set(key, promise)
    return promise
  }

  clear() {
    this.cache.clear()
    this.pending.clear()
  }
}

const cache = new CacheService()

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10)
const COMP_MAP_TTL = 300_000

async function getCompetitorMap() {
  return cache.getOrFetch('competitorMap', async () => {
    const map = {}
    try {
      const data = await scores365.getTopCompetitors(500)
      const comps = data?.competitors || []
      for (const c of comps) {
        map[String(c.id)] = { name: c.name, imageVersion: c.imageVersion || 1 }
      }
    } catch (_) { /* fall back to empty map */ }
    return map
  }, COMP_MAP_TTL)
}

module.exports = { cacheService: cache, getCompetitorMap }
