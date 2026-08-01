# Fase 5 — Activar ruta HTTP PostgREST de Supabase

> **Objetivo**: activar la ruta HTTP de Supabase JS (`@supabase/supabase-js`) añadiendo las
> variables de entorno faltantes. El código ya está completo desde Fase 4 del refactor anterior.
> Solo es configuración de entorno.

**Esfuerzo**: 1-2 horas · **Riesgo**: Bajo (es solo config, el wrapper tiene rollback automático) ·
**Depende de**: Fase 3 (migraciones aplicadas y DB estable) · **Estado**: ⏳ Pendiente

---

## 1. Diagnóstico

Actualmente `database/supabaseClient.js` existe y `database/db.js` tiene lógica dual completa,
pero al no haber `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` en el entorno:

- `supabaseClient.isEnabled()` retorna `false`
- `db.query()`, `db.insert()`, `db.upsert()` etc. caen automáticamente a las funciones
  `queryViaPg`, `insertViaPg`, `upsertViaPg` (pg directo)
- `db.execAdvanced()` siempre usa pg (es su propósito)
- El pool pg tiene `max=1`, que es seguro pero limita concurrencia en Vercel

## 2. Preparación

### 2.1 — Obtener credenciales

Desde el panel de Supabase (https://supabase.com/dashboard/project/jcfulxsqayscvqgxemhv):

| Variable | Dónde encontrarla |
|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string (URI) |

### 2.2 — Verificar conectividad

Antes de deployar, probar localmente:

```bash
# Añadir al .env
echo "SUPABASE_URL=https://jcfulxsqayscvqgxemhv.supabase.co" >> .env
echo "SUPABASE_SERVICE_ROLE_KEY=eyJ..." >> .env

# Verificar
node scripts/check-supabase-config.js
# Output esperado:
# ✅ DB_HOST: db.jcfulxsqayscvqgxemhv.supabase.co
# ✅ DB_PORT: 5432
# ✅ DB_USER: postgres
# ✅ DB_NAME: postgres
# ✅ SUPABASE_URL: https://jcfulxsqayscvqgxemhv.supabase.co
# ✅ SUPABASE_SERVICE_ROLE_KEY: configurada
# ✅ dbStrategy: http+pg-fallback

# Probar health endpoint
curl http://localhost:3002/api/football/health | jq .dbStats
# Output esperado:
# {
#   "supabaseCalls": 0,
#   "pgCalls": 0,
#   "supabaseErrors": 0,
#   "pgErrors": 0
# }
# (contadores en cero hasta que se hagan requests)
```

## 3. Deploy

### 3.1 — Vercel Production + Preview

```bash
# Production
vercel env add SUPABASE_URL production
# Pegar: https://jcfulxsqayscvqgxemhv.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Pegar: eyJ...

# Preview (mismos valores)
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# Redeploy
vercel --prod
```

### 3.2 — Validar en producción

```bash
curl https://scorehub-pocho.vercel.app/api/football/health | jq .
# Buscar:
# - "dbStrategy": "http+pg-fallback"
# - "dbStats.supabaseCalls" > 0 tras navegar por la web
# - "dbStats.pgCalls" debe ser minoría (< 20%)
```

## 4. Monitoreo post-activación

### 4.1 — Dashboard de salud

El endpoint `/api/football/health` expone:

```json
{
  "status": "ok",
  "db": "connected",
  "dbStrategy": "http+pg-fallback",
  "dbStats": {
    "supabaseCalls": 1240,
    "pgCalls": 87,
    "supabaseErrors": 2,
    "pgErrors": 0,
    "supabasePercent": 93.4
  }
}
```

### 4.2 — Qué observar

| Métrica | Bueno | Alerta |
|---|---|---|
| `supabasePercent` | > 80 % | < 50 % → algo fuerza pg |
| `pgErrors` | 0 | > 0 → revisar `connection.js` |
| `supabaseErrors` | < 1 % | > 5 % → PostgREST puede tener issues |
| Latencia p95 | ≤ baseline | > 20 % → HTTP overhead alto |

## 5. Rollback

Si la activación causa problemas:

1. **Quitar las env vars** en Vercel:
   ```bash
   vercel env rm SUPABASE_URL production
   vercel env rm SUPABASE_SERVICE_ROLE_KEY production
   vercel --prod
   ```

2. El wrapper `database/db.js` detecta la ausencia automáticamente y cae a pg con `max=1`.
   **No requiere deploy de código.**

3. Si el problema persiste post-rollback, verificar que `connection.js` tiene `max=1`:
   - Esto evita `EMAXCONNSESSION` incluso en modo pg-only.

## 6. Criterio de aceptación

- [ ] `scripts/check-supabase-config.js` reporta `✅ dbStrategy: http+pg-fallback`
- [ ] `supabasePercent > 80 %` en health tras navegar por todas las rutas del dashboard
- [ ] Cero errores `EMAXCONNSESSION` en logs de Vercel
- [ ] Latencia p95 comparable a línea base (≤20 % de diferencia)
