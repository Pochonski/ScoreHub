# Fase 11 — Fix Backend (Server)

**Objetivo:** Refactorizar el God Object de 1516 líneas, agregar tests, mejorar observabilidad, preparar para producción.

**Esfuerzo estimado:** 5-7 días
**Requisito:** Fase 9 (seguridad y queries)

---

## 11.1 Dividir footballController.js en Servicios

**Archivo actual:** `dashboard/server/controllers/footballController.js` (1516 líneas, 32 funciones)

**Estructura nueva:**

```
dashboard/server/
├── index.js
├── package.json
├── routes/
│   └── football.js           (mantener, solo rutas -> controllers)
├── controllers/
│   ├── matchController.js    (13 endpoints de matches)
│   ├── standingController.js (getStandings)
│   ├── bracketController.js  (getBrackets)
│   ├── historyController.js  (6 endpoints de history)
│   ├── statsController.js    (getTopScorers, Assists, Ratings, TeamOfWeek)
│   ├── trendController.js    (getCompetitionTrends)
│   ├── newsController.js     (getNews, getNewsByGame)
│   ├── athleteController.js  (5 endpoints de athletes)
│   ├── teamController.js     (3 endpoints de teams)
│   └── infoController.js     (getCountries, getTournamentInfo)
├── services/
│   ├── cosmosService.js      (wrapper de database/cosmos.js)
│   ├── scores365Service.js   (wrapper de services/scores365Service.js)
│   ├── cacheService.js       (centraliza _compMap, _historyCache)
│   └── enrichService.js      (enrichTeam, enrichAthlete, enrichGame)
├── middleware/
│   ├── errorHandler.js       (manejo unificado de errores)
│   ├── validate.js           (validación de params con zod)
│   └── requestLogger.js      (logging estructurado)
└── utils/
    └── mappers.js            (enrichTeam, enrichAthlete, helpers)
```

**Cada controller:** máximo 80-120 líneas. Delega en services.

---

## 11.2 Logger Estructurado

**Instalar:**
```bash
npm install pino pino-http
```

**En `index.js`:**
```js
const pinoHttp = require('pino-http')
app.use(pinoHttp({
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined
}))
```

**Cada controller:**
```js
router.get('/matches', async (req, res, next) => {
  req.log.info({ params: req.query }, 'Obteniendo partidos')
  try {
    const data = await matchService.getMatches(req.query)
    res.json(data)
  } catch (err) {
    req.log.error({ err }, 'Error al obtener partidos')
    next(err)
  }
})
```

---

## 11.3 Cache Stampede Protection

**Archivo nuevo:** `services/cacheService.js`

```js
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
}

module.exports = new CacheService()
```

---

## 11.4 Graceful Shutdown + PM2

**En `index.js`:**
```js
const server = app.listen(PORT, () => {
  console.log(`🏆 Mundialista Dashboard API en puerto ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...')
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor...')
  server.close(() => process.exit(0))
})
```

**En `ecosystem.config.js` (raíz):**
```js
module.exports = {
  apps: [
    {
      name: 'botmundialista-telegram',
      script: 'telegramBot.js',
    },
    {
      name: 'mundialista-dashboard',
      script: 'dashboard/server/index.js',
      instances: process.env.WEB_CONCURRENCY || 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
}
```

---

## 11.5 Tests de Backend

**Instalar:**
```bash
npm install --save-dev supertest jest
```

**Test de ejemplo:**
```js
// tests/matches.test.js
const request = require('supertest')
const app = require('../index')

jest.mock('../services/cosmosService')

describe('GET /api/football/matches', () => {
  it('devuelve 200 con array de partidos', async () => {
    const res = await request(app).get('/api/football/matches')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('devuelve 400 si statusGroup es inválido', async () => {
    const res = await request(app).get('/api/football/matches?statusGroup=foo')
    expect(res.status).toBe(400)
  })
})
```

**Cobertura mínima:**
- Un test por ruta (status 200)
- Test de validación de parámetros (status 400)
- Test de error de Cosmos (status 500)
- Test de CORS (header `Access-Control-Allow-Origin`)

---

## 11.6 Paginación y Proyección

**Endpoints a paginar:**
- `GET /api/football/matches?page=1&limit=20`
- `GET /api/football/news?page=1&limit=20`
- `GET /api/football/athletes?page=1&limit=20`

**Proyección en queries:**
```diff
- SELECT * FROM c WHERE c.competitionId = @compId
+ SELECT c.id, c.name, c.statusGroup, c.startTime, c.homeCompetitor, c.awayCompetitor
+ FROM c WHERE c.competitionId = @compId
```

---

## 11.7 Health Check Mejorado

```js
app.get('/api/football/health', async (req, res) => {
  const start = Date.now()
  try {
    await cosmos.health()
    res.json({
      status: 'ok',
      cosmos: 'connected',
      uptime: process.uptime(),
      latency: `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    res.status(503).json({
      status: 'degraded',
      cosmos: 'disconnected',
      uptime: process.uptime(),
      error: e.message,
    })
  }
})
```

---

## Criterios de Aceptación Fase 11

- [ ] `footballController.js` dividido en ≤10 controllers de ≤120 líneas cada uno
- [ ] CacheService con thundering herd protection
- [ ] Pino logger estructurado implementado
- [ ] Graceful shutdown (SIGTERM/SIGINT)
- [ ] PM2 config con dashboard server
- [ ] ≥10 tests de integración con supertest
- [ ] Paginación en endpoints de listado
- [ ] Proyección en queries Cosmos
- [ ] Health check verifica conexión Cosmos
- [ ] Error handler middleware unificado
