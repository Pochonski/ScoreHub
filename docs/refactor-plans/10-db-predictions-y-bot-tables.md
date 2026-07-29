# Fase 2 — Poblar predictions y corregir tablas de bot vacías

> **Objetivo**: resolver los dos gaps de datos faltantes: `predictions` (0 filas) y
> tablas de bot (`usuarios`, `equipos_seguidos`, etc.) vacías.

**Esfuerzo**: 4-6 horas · **Riesgo**: Medio · **Depende de**: Fase 1 · **Estado**: ⏳ Pendiente

---

## 1. Diagnóstico

### 1.1 — `predictions` = 0 filas

`SELECT count(*) FROM predictions;` → 0. Esto impacta:
- **Dashboard**: endpoint `GET /matches/:id/predictions` (DB_FIRST, siempre cae a 365)
- **Bot**: comando `/predicciones <id>` (DB_ONLY, muestra "no hay datos")

Posibles causas:
1. El endpoint `scores365.getPredictions(sports)` devuelve 0 resultados en esta temporada
2. El sync job falla silenciosamente (`src/application/sync/trendsOdds.js`)
3. La tabla fue creada pero nunca corrida la migration con seed

### 1.2 — Tablas bot vacías

Tablas con 0 filas: `usuarios`, `equipos_seguidos`, `historial_consultas`, `apuestas`,
`apuesta_selecciones`, `eventos_apuesta`, `bet_followers`, `bet_followers_v2`.

Posibles causas:
1. El bot en producción apunta a **otra** instancia de Supabase (DB_HOST diferente)
2. El bot nunca se ha usado contra esta DB
3. RLS bloquea escrituras (pero el py superuser debe bypassearlo)

## 2. Plan de acción

### Sub-tarea 2.1 — `predictions` (2-3 h)

```bash
# 1. Verificar si la API devuelve datos
curl -s 'https://webws.365scores.com/web/games/predictions/?sports=1&langId=14' | head -c 500

# 2. Si devuelve datos, ejecutar sync manual
node -e "require('./src/application/sync/trendsOdds').syncPredictions()" 2>&1

# 3. Si devuelve 0/error, evaluar opción B:
#    Deshabilitar el endpoint en bot y dashboard con mensaje claro
```

**Opción A — fix sync** (si API devuelve datos):
- Corregir bug en `src/application/sync/trendsOdds.js` (función `syncPredictions`)
- Verificar que `scores365.getPredictions()` está mappeada correctamente
- Test: `SELECT count(*) FROM predictions WHERE updated_at > now() - interval '1 hour'`

**Opción B — deshabilitar** (si API no devuelve nada para esta temporada):
- Dashboard: en `matchController.getMatchPredictions`, devolver `{ data: [], meta: { available: false } }`
- Bot: en `commands/matchDetail.js`, cambiar mensaje a "Predicciones no disponibles para este partido"

### Sub-tarea 2.2 — Tablas bot (2-3 h)

```bash
# 1. Verificar el .env usado por el proceso en producción
pm2 show scorehub-bot  # o systemctl status scorehub-bot
# Revisar DB_HOST

# 2. Comparar DB_HOST del .env actual vs .env del proceso bot
cat .env | grep DB_HOST
pm2 env scorehub-bot 2>/dev/null | grep DB_HOST
```

**Opción A — misma DB pero vacía por falta de uso**:
- Escribir test E2E: `tests/integration/bot.persistence.test.js`
  - `userStorage.setAlias(userId, 'testuser')` → verificar fila en `usuarios`
  - `userStorage.getTeams(userId)` → verificar `equipos_seguidos`
- El test debe pasar con el bot real contra la DB real

**Opción B — el bot apunta a otra DB**:
- Decisión de producto:
  - ¿Migrar los datos de la otra DB a esta? (pg_dump + psql)
  - ¿O cambiar DB_HOST del .env actual para que apunte a la otra DB?
  - ¿O tener dos DBs (una para bot, otra para dashboard)?
- Documentar la decisión en `docs/architecture/db-coverage.md`

## 3. Tests a añadir

| Archivo | Tipo | Cubre |
|---|---|---|
| `tests/integration/predictions-sync.test.js` | Integration | Verifica que el sync popula predictions |
| `tests/integration/bot.persistence.test.js` | Integration | Verifica escritura/lectura de usuario |
| `tests/unit/predictions-fallback.test.js` | Unit | Dashboard y bot manejan predictions=0 |

## 4. Criterio de aceptación

### Predictions
- [ ] `predictions` tiene filas con `updated_at` reciente **O** el endpoint está deshabilitado con mensaje claro
- [ ] Dashboard `/matches/:id/predictions` no tira error si predictions está vacío

### Bot tables
- [ ] Se conoce a qué DB apunta el bot en producción
- [ ] `usuarios`, `equipos_seguidos`, `historial_consultas` son operativas contra la DB que usa el dashboard
- [ ] `tests/integration/bot.persistence.test.js` pasa

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migrar datos entre DBs puede perder info | Backup completo antes de migrar |
| Si predictions=0 es permanente, el frontend/bot necesita cambios | Los cambios son mínimos (deshabilitar feature) |
| El bot y dashboard apuntan a DBs diferentes | Decisión de producto documentada |
