# Fase 10 — Fix Arquitectura y Patrones

**Objetivo:** Unificar patrones de acceso a datos, estandarizar mappers con Zod, eliminar dead code de infrastructure/, completar repositorios faltantes, y limpiar inconsistencia de tipos.

**Esfuerzo estimado:** 3-4 días
**Requisito:** Fase 9 completada

---

## 10.1 Completar DI Container

**Archivo:** `src/infrastructure/di/DiContainer.ts`

**Acción:** Agregar los 6 repositorios faltantes. Implementar cache singleton (no crear nueva instancia en cada get).

```typescript
export class DiContainer {
  private static instance: DiContainer
  private repos = new Map<string, any>()

  static getInstance(): DiContainer { ... }

  private getOrCreate<T>(key: string, factory: () => T): T {
    if (!this.repos.has(key)) {
      this.repos.set(key, factory())
    }
    return this.repos.get(key) as T
  }

  getGameRepository(): GameRepository {
    return this.getOrCreate('game', () => new ApiGameRepository())
  }
  getNewsRepository(): NewsRepository { return this.getOrCreate('news', () => new ApiNewsRepository()) }
  getAthleteRepository(): AthleteRepository { return this.getOrCreate('athlete', () => new ApiAthleteRepository()) }
  getTeamRepository(): TeamRepository { return this.getOrCreate('team', () => new ApiTeamRepository()) }
  getHistoryRepository(): HistoryRepository { return this.getOrCreate('history', () => new ApiHistoryRepository()) }
  getTournamentInfoRepository(): TournamentInfoRepository { return this.getOrCreate('tInfo', () => new ApiTournamentInfoRepository()) }
  getStandingRepository(): StandingRepository { return this.getOrCreate('standing', () => new ApiStandingRepository()) }
  getTournamentStatsRepository(): TournamentStatsRepository { return this.getOrCreate('tStats', () => new ApiTournamentStatsRepository()) }
  getBettingTipRepository(): BettingTipRepository { return this.getOrCreate('betting', () => new ApiBettingTipRepository()) }
  getBracketRepository(): BracketRepository { return this.getOrCreate('bracket', () => new ApiBracketRepository()) }
}
```

---

## 10.2 Crear ApiBracketRepository

**Archivo nuevo:** `src/data/repositories/ApiBracketRepository.ts`

```typescript
import { BracketRepository } from '@/domain/repositories/BracketRepository'
import { apiClient } from '@/data/datasources/ApiClient'
import { ENDPOINTS } from '@/infrastructure/config'

export class ApiBracketRepository implements BracketRepository {
  async getBrackets(): Promise<any> {
    return apiClient.get(ENDPOINTS.brackets)
  }
}
```

**Pendiente:** Crear entidad `Bracket` completa en `domain/entities/Bracket.ts` si está incompleta.

---

## 10.3 Implementar Zod en Todos los Mappers

**Archivos:**
- `data/mappers/AthleteMapper.ts` — agregar `AthleteSchema`
- `data/mappers/StandingMapper.ts` — agregar `StandingSchema`
- `data/mappers/GameMapper.ts` — corregir: usar `parsed.data` en vez de `raw.* as`

**Patrón a seguir:**
```typescript
const AthleteSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().optional(),
})

export function mapAthlete(raw: Record<string, unknown>): Athlete {
  const parsed = AthleteSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Athlete inválido', parsed.error)
  }
  return parsed.data
}
```

**Corrección en GameMapper (existente):**
```diff
- id: raw.id as number,
- statusGroup: raw.statusGroup as GameStatusGroup,
+ id: parsed.data.id,
+ statusGroup: parsed.data.statusGroup,
```

---

## 10.4 Limpiar Infrastructure/ — Dead Code

### Eliminar:
- `src/infrastructure/security/rateLimiter.ts` (pasa al backend)

### Integrar o eliminar:
- `RemoteCache.ts` — si no se usa en producción, eliminar
- `useCache.ts` — si no se usa en ningún componente, eliminar

### Si se decide mantener:
Agregar límite de entradas en `InMemoryCache.ts`:
```typescript
export class InMemoryCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize: number

  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    // ... resto
  }
}
```

---

## 10.5 Agregar AbortController en Hooks

**Archivos:** Todos los hooks en `hooks/*.ts`

**Patrón:**
```typescript
export function useGames(params?: Params) {
  const fetch = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    const repo = DiContainer.getInstance().getGameRepository()
    const data = await repo.getGames(params, { signal })
    if (!signal.aborted) {
      setGames(data)
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(ctrl.signal).catch((e) => {
      if (e.name !== 'AbortError') {
        setError(e.message)
        setLoading(false)
      }
    })
    return () => ctrl.abort()
  }, [fetch])
}
```

**Actualizar interfaces de repositorio** para aceptar `{ signal?: AbortSignal }` en opciones.

---

## 10.6 Estandarizar Tipado de Hooks

### `useTournamentStats.ts`
```diff
- const [teamOfWeek, setTeamOfWeek] = useState<unknown>(null)
+ interface TeamOfWeekData {
+   formation: string
+   players: TeamOfWeekPlayer[]
+ }
+ const [teamOfWeek, setTeamOfWeek] = useState<TeamOfWeekData | null>(null)
```

### `useHistoryDetail.ts`
Eliminar `any` en `mapStats` y `mapLineups`:
```typescript
function mapStats(raw: Record<string, unknown>): HistoricalMatchStats | null { ... }
function mapLineups(raw: Record<string, unknown>): HistoricalMatchLineup | null { ... }
```

### `useNews.ts`
Corregir `hasMore`:
```typescript
const [hasMore, setHasMore] = useState(true)

if (data.length < limitRef.current) setHasMore(false)
```

---

## 10.7 Migrar de Console a Logger

**Archivos:** hooks y helpers que usan `console.log/warn/error`

**Buscar:** `console\.(log|warn|error)` en `src/`

**Acción:** Reemplazar con `logger.info|warn|error` de `@/infrastructure/logging/Logger`

---

## Criterios de Aceptación Fase 10

- [ ] DiContainer tiene los 10 repositorios registrados
- [ ] `ApiBracketRepository` implementado
- [ ] `AthleteMapper` y `StandingMapper` usan Zod
- [ ] `GameMapper` usa `parsed.data` correctamente
- [ ] `RemoteCache` y `useCache` o se integran o se eliminan
- [ ] `InMemoryCache` con límite de entradas
- [ ] Todos los hooks tienen AbortController
- [ ] `useTournamentStats` tipado correctamente (no `unknown`)
- [ ] `useHistoryDetail` sin `any`
- [ ] No hay `console.log` en `src/` (todo por Logger)
