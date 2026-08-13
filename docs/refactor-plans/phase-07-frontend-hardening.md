# Fase 7 — Frontend hardening

**Estado:** ⏳ Pendiente
**Esfuerzo:** 4-5 h
**Riesgo:** Bajo
**Bloquea deploy:** No
**PR:** `hardening/phase-07-frontend`

## Objetivo

Endurecer el dashboard React: CSP, logger cliente off en prod, cache LRU, hook errors visibles, origin fallback.

## Cambios

### 7.1 — CSP en `dashboard/index.html`

**Archivo:** `dashboard/index.html`

**Cambio:** agregar `<meta http-equiv="Content-Security-Policy" content="...">` en el `<head>`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://imagecache.365scores.com data:;
  font-src 'self' data:;
  connect-src 'self' https://jcfulxsqayscvqgxemhv.supabase.co;
  worker-src 'self';
  manifest-src 'self';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
">
```

**Nota:** `'unsafe-inline'` para `style-src` es necesario porque Tailwind 4 genera estilos inline. Para `script-src` no se permite inline (React 19 con StrictMode debería compilar sin inline scripts).

**Verificación:** abrir DevTools → Console → verificar que no hay violaciones CSP. Testear manualmente:
- Carga inicial ✓
- Fetch a `/api/football/*` ✓
- Imágenes desde `imagecache.365scores.com` ✓

**Esfuerzo:** 30 min.

### 7.2 — Client logger off en producción

**Archivo:** `dashboard/src/infrastructure/logging/Logger.ts` (líneas 46-48)

**Problema:** el logger hace `console.error` por default en producción, exponiendo detalles internos en la consola del navegador.

**Cambio:**
```ts
const isProduction = import.meta.env.PROD;
let enabled = !isProduction;

export const Logger = {
  setEnabled(value: boolean) { enabled = value; },
  error(...args: unknown[]) { if (enabled) console.error('[scorehub]', ...args); },
  warn(...args: unknown[]) { if (enabled) console.warn('[scorehub]', ...args); },
  info(...args: unknown[]) { if (enabled) console.info('[scorehub]', ...args); },
  debug(...args: unknown[]) { if (enabled) console.debug('[scorehub]', ...args); },
};
```

**Esfuerzo:** 10 min.

### 7.3 — LRU en `InMemoryCache`

**Archivo:** `dashboard/src/infrastructure/cache/InMemoryCache.ts` (líneas 16-19)

**Problema:** evicción FIFO — entradas accedidas frecuentemente pueden ser evictadas prematuramente.

**Cambio:** usar `Map` (que preserva insertion order) + mover entrada accedida al final vía `delete` + `set`:
```ts
class InMemoryCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  private maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    // LRU: mover al final
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }
}
```

**Esfuerzo:** 30 min.

### 7.4 — Hook errors visibles al usuario

**Archivos:**
- `dashboard/src/presentation/hooks/useGameDetail.ts` (líneas 45-53)
- `dashboard/src/presentation/hooks/useTeams.ts` (líneas 21-25, 49-52)
- `dashboard/src/presentation/hooks/useAthletes.ts:104` (Promise.allSettled → unhandled)

**Problema:** errores parciales silenciados con `.catch(() => null)`.

**Cambio:** además de fallback silencioso, exponer `partialError` flag para que la UI muestre banner discreto:
```ts
// useGameDetail.ts
const [partialError, setPartialError] = useState<Error | null>(null);

const results = await Promise.all([
  fetchOutrights(id).catch((e) => { setPartialError(e); return null; }),
  fetchPrevia(id).catch((e) => { setPartialError(e); return null; }),
  // ...
]);

return { data: { /* merged */ }, loading, error, refetch, partialError };
```

Y en el componente consumidor:
```tsx
{partialError && (
  <div className="bg-amber-50 border border-amber-200 px-4 py-2 text-sm">
    Algunos datos no pudieron cargarse. <button onClick={refetch}>Reintentar</button>
  </div>
)}
```

**Esfuerzo:** 1 h.

### 7.5 — `window.location.origin` fallback removal

**Archivo:** `dashboard/src/infrastructure/http/HttpClient.ts` (línea 18)

**Problema:** si `baseUrl` es relativa (`/api/football`), se resuelve contra `window.location.origin` que puede no ser el esperado (mixed-protocol).

**Cambio:** requerir `baseUrl` absoluta en producción, relativa sólo en dev:
```ts
constructor(baseUrl: string, options?: HttpClientOptions) {
  this.baseUrl = baseUrl;
  this.options = { timeout: 10000, ...options };
  if (import.meta.env.PROD && baseUrl.startsWith('/')) {
    throw new Error(`HttpClient: baseUrl must be absolute in production, got "${baseUrl}"`);
  }
}

private buildUrl(path: string): string {
  return new URL(path, this.baseUrl).toString();
}
```

**Esfuerzo:** 15 min.

## Tests nuevos

- `dashboard/tests/cache.lru.test.ts`:
  - Set 500 entries, get primera → la entrada sigue.
  - Set 501 entries, get primera → fue evictada.
  - Get LRU entry actualiza su posición.
- `dashboard/tests/http-client.test.ts`:
  - Constructor en prod con baseUrl relativa lanza error.
  - Constructor en dev con baseUrl relativa acepta.
- Smoke test: abrir DevTools después de build de prod → console.error del cliente no aparece.

## Criterios de aceptación

- [ ] CSP meta en `dashboard/index.html`.
- [ ] `Logger` off en producción por default.
- [ ] `InMemoryCache` usa LRU.
- [ ] Hooks principales exponen `partialError` flag.
- [ ] `HttpClient` rechaza baseUrl relativa en prod.
- [ ] Tests nuevos pasan.
- [ ] Build de producción verificado manualmente.

## Rollback

Revert del commit. Cambios aditivos.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `dashboard/index.html` | ~15 líneas (CSP meta) |
| `dashboard/src/infrastructure/logging/Logger.ts` | ~5 líneas |
| `dashboard/src/infrastructure/cache/InMemoryCache.ts` | ~20 líneas (LRU) |
| `dashboard/src/presentation/hooks/useGameDetail.ts` | ~15 líneas (partialError) |
| `dashboard/src/presentation/hooks/useTeams.ts` | ~10 líneas |
| `dashboard/src/infrastructure/http/HttpClient.ts` | ~5 líneas |
| Tests nuevos | ~80 líneas |