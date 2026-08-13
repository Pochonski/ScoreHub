# Fase 6 — DB cleanup + migración 025

**Estado:** ⏳ Pendiente
**Esfuerzo:** 3 h
**Riesgo:** Medio
**Bloquea deploy:** No
**PR:** `hardening/phase-06-db-cleanup`

## Objetivo

- Drop `bet_followers` v1 (dead weight desde migración 019).
- Agregar `pg_advisory_lock` al migrate runner para serializar ejecuciones.
- Marcar `database/schema.sql` como histórico.
- Validar `DB_PASSWORD` no vacío en conexiones Supavisor.
- Documentar el SSL relaxed en Supabase.

## Cambios

### 6.1 — Migración 025: DROP `bet_followers` v1

**Archivo nuevo:** `database/migrations/025_drop_bet_followers_v1.sql`

**Precondición (validar antes de mergear):**
```sql
SELECT COUNT(*) FROM bet_followers;
-- Si retorna > 0 rows, NO mergear — primero migrar datos a bet_followers_v2.
```

**Contenido:**
```sql
-- 025_drop_bet_followers_v1.sql
-- Limpia la tabla legacy bet_followers (introducida en migración 003).
-- Reemplazada por bet_followers_v2 (migración 019) con FK proper a apuestas(id).
-- Aplicable solo si la tabla v1 está vacía.
--
-- Pre-check (ejecutar manualmente antes de aplicar):
--   SELECT COUNT(*) FROM bet_followers;
-- Si retorna > 0, primero migrar datos y luego aplicar este drop.

BEGIN;

DROP TABLE IF EXISTS bet_followers CASCADE;

COMMIT;
```

**Aplicación:**
1. Verificar pre-check en producción.
2. Aplicar manualmente via `psql $SUPABASE_DB_URL -f database/migrations/025_drop_bet_followers_v1.sql`.
3. Commit del SQL + actualizar `database/migrations/README.md` (si existe) o agregar nota.

**Esfuerzo:** 30 min + PR de aplicación manual.

### 6.2 — `pg_advisory_lock` en migrate runner

**Archivo:** `database/migrate.js` (línea 22-58)

**Problema:** dos `node migrate.js` paralelos podrían aplicar migraciones no-idempotentes dos veces.

**Cambio:**
```js
const { pool } = require('./connection');

async function run() {
  const lockId = 5930; // ScoreHub fixed lock
  const client = await pool.connect();
  try {
    const lockResult = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [lockId]);
    if (!lockResult.rows[0].locked) {
      console.error('Another migrate.js is already running. Exiting.');
      process.exit(1);
    }

    await client.query('BEGIN');
    // ... existing logic (create schema_migrations table, get applied, etc.)
    await client.query('COMMIT');

    for (const migration of pending) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [migration.name]);
        await client.query('COMMIT');
        console.log(`✓ ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    client.release();
  }
}
```

**Esfuerzo:** 1 h.

### 6.3 — Marcar `schema.sql` como histórico

**Archivo:** `database/schema.sql` (línea 1-2)

**Cambio:** agregar header:
```sql
-- ═══════════════════════════════════════════════════════════════
-- HISTORICAL — NO USAR. Supersedida por migrations/002-025.
-- Conservada como referencia de la estructura original (MySQL-era).
-- Para aplicar schema actual, ejecutar migrations/ en orden.
-- ═══════════════════════════════════════════════════════════════

-- (contenido existente sin tocar)
```

**Esfuerzo:** 5 min.

### 6.4 — Validar `DB_PASSWORD` no vacío

**Archivo:** `database/connection.js` (línea 54)

**Cambio:** después de leer `process.env.DB_PASSWORD`:
```js
const password = process.env.DB_PASSWORD ?? '';
if (process.env.SUPABASE_DB_URL && password === '') {
  throw new Error('SUPABASE_DB_URL requires non-empty DB_PASSWORD in connection string');
}
```

O alternativamente, validar en el parse de la URL:
```js
const url = process.env.SUPABASE_DB_URL;
if (url) {
  const parsed = new URL(url);
  if (!parsed.password) {
    throw new Error('SUPABASE_DB_URL must include password');
  }
}
```

**Esfuerzo:** 15 min.

### 6.5 — Documentar SSL relaxed

**Archivo:** `database/connection.js` (línea 49)

**Cambio:** agregar comentario antes de `ssl: { rejectUnauthorized: false }`:
```js
// Supavisor usa certificados auto-firmados en algunos pools.
// rejectUnauthorized: false es necesario para conectar, pero significa
// que MITM protection depende sólo de TLS. NO exponer el puerto a redes
// no confiadas. Para producción con CA bundle propio, agregar `ca: fs.readFileSync(...)`.
ssl: { rejectUnauthorized: false },
```

**Esfuerzo:** 5 min.

## Tests nuevos

- `tests/integration/migrate-lock.test.js`:
  - Dos `pool.connect()` + `pg_try_advisory_lock(5930)` paralelos → uno retorna `true`, otro `false`.
- Smoke test post-migración: `psql -c "SELECT to_regclass('bet_followers');"` debe retornar null.

## Criterios de aceptación

- [ ] `025_drop_bet_followers_v1.sql` agregado.
- [ ] `migrate.js` usa `pg_try_advisory_lock(5930)`.
- [ ] `database/schema.sql` marcado como histórico.
- [ ] Validación de `DB_PASSWORD` no vacío.
- [ ] Comentario SSL en `connection.js`.
- [ ] Migración 025 aplicada en staging.
- [ ] CI verde.

## Rollback

Si la migración 025 rompe algo en producción, restaurar desde backup (tabla pequeña, bajo riesgo). El `pg_advisory_lock` se puede sacar comentando la sección. El resto son aditivos.

## Archivos tocados

| Archivo | Líneas estimadas |
|---|---|
| `database/migrations/025_drop_bet_followers_v1.sql` (nuevo) | ~15 líneas |
| `database/migrate.js` | ~25 líneas (lock + unlock) |
| `database/schema.sql` | ~10 líneas (header histórico) |
| `database/connection.js` | ~10 líneas (validación + comentario) |