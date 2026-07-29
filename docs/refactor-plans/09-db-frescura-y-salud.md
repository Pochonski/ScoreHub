# Fase 1 — Frescura y salud del sync

> **Objetivo**: restaurar la frescura de las tablas de caché críticas que están stale
> (`games` 6.7 días, `athletes` 7 días, `news` 12 días, `odds_lines` 11 días, `game_pre_stats` 9 días).

**Esfuerzo**: 2-4 horas · **Riesgo**: Bajo · **Depende de**: Fase 0 (docs) · **Estado**: ⏳ Pendiente

---

## 1. Diagnóstico

La query de freshness reporta:

| Tabla | Antigüedad máxima | Frecuencia esperada | Estado |
|---|---|---|---|
| `games` | 6.7 días | 60 s | 🔴 Stale |
| `athletes` | 7 días | 10 min | 🔴 Stale |
| `news` | 12 días | 10 min | 🔴 Stale |
| `odds_lines` | 11 días | 5 min | 🔴 Stale |
| `game_pre_stats` | 9 días | 5 min | 🔴 Stale |
| `standings` | 1 min | 2 min | ✅ OK |
| `venues`, `team_of_week`, `tournament_stats` | 33 min | 10 min | ✅ OK |
| `odds_outrights` | 3.5 h | 10 min | ⚠️ |
| `competitions`, `countries`, `competition_history` | 23 h | 6 h | ⚠️ |

Algunos jobs están corriendo (standings, venues) y otros no. Posibles causas:
- El proceso de sync no está corriendo continuamente
- Ciertos jobs fallan silenciosamente (bug conocido de `withTransaction` no importado, ya fix en master)
- La API de 365scores devuelve errores para ciertos endpoints
- Algún job guard bloquea por overlap mal detectado

## 2. Plan de acción

### Paso 1 — Diagnosticar (1 h)

1. Verificar si el proceso de sync está en ejecución:
   ```bash
   pm2 status              # ¿bot + sync levantados?
   ps aux | grep sync.js   # ¿proceso activo?
   journalctl -u scorehub-sync --since "7 days ago" | tail -100
   ```

2. Ejecutar los jobs sospechosos manualmente y ver output:
   ```bash
   node -e "require('./src/application/sync/games').syncGames()" 2>&1
   node -e "require('./src/application/sync/details').syncGameDetails()" 2>&1
   node -e "require('./src/application/sync/content').syncNews()" 2>&1
   ```

3. Revisar `jobGuard` en `src/interface/scheduler/scheduler.js` para detectar overlaps falsos.

### Paso 2 — Acciones correctivas (1-3 h)

Según lo que revele el diagnóstico:

| Hallazgo | Acción |
|---|---|
| Sync no corre | `pm2 start sync.js --name scorehub-sync` o systemd |
| Job X falla con `ReferenceError: withTransaction` | Ya fix en master (commit Fase 7). Hacer cherry-pick si no está |
| API devuelve 429/error | Ampliar `request` con reintento exponencial |
| jobGuard detecta overlap falso | Ajustar TTL de `processGuard` / `jobGuard` |

### Paso 3 — Añadir métricas (opcional)

Añadir contador en `utils/dbStats.js` para reportar:
```js
syncJobsByStatus: {
  ok: 12,
  failed: 3,
  skipped: 1,
  lastRunAt: '2026-07-29T14:00:00Z'
}
```

## 3. Tests a añadir

| Archivo | Tipo | Cubre |
|---|---|---|
| `tests/sync.freshness.test.js` | Integration | Falla si `MAX(updated_at)` de tabla crítica > N horas |
| `tests/sync.jobGuard.test.js` | Unit | Verifica que jobGuard no bloquea falsamente |

## 4. Criterio de aceptación

- [ ] `MAX(updated_at)` de `games` < 1 hora
- [ ] `MAX(updated_at)` de `athletes` < 24 horas
- [ ] `MAX(updated_at)` de `news` < 24 horas
- [ ] `MAX(updated_at)` de `odds_lines` < 24 horas
- [ ] `predictions` sigue en 0 (eso es Fase 2)
- [ ] `tests/sync.freshness.test.js` pasa en verde

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| API de 365scores caída | No es controlable. El fallback de los endpoints DB_FIRST lo cubre |
| Los logs no existen (producción) | Iniciar logging estructurado si no hay |
| jobGuard impide correr jobs en dev | Usar `SKIP_JOB_GUARD=true` para desarrollo |
