# Fase 3 — Cobertura DB completa (cerrar endpoints 365_ONLY)

> **Objetivo**: eliminar los 5 endpoints del dashboard que nunca consultan DB,
> creando las tablas y sync jobs faltantes.

**Esfuerzo**: 6-10 horas · **Riesgo**: Medio-Alto (migraciones + nuevos sync jobs) ·
**Depende de**: Fases 0-2 · **Estado**: ⏳ Pendiente

---

## 1. Diagnóstico

5 endpoints del dashboard nunca consultan la DB — cada request viaja a 365scores:

| Endpoint | Controller | Función | Lo que obtiene |
|---|---|---|---|
| `GET /trends/details` | `trendDetailController.getTrendDetails` | Detalle de una tendencia | Score/stat específico por trend ID |
| `GET /teams/:id/recent-form` | `teamEnhancementsController.getTeamRecentForm` | Últimos N partidos del equipo | Forma reciente |
| `GET /teams/:id/upcoming` | `teamEnhancementsController.getTeamUpcoming` | Próximos partidos del equipo | Fixtures |
| `GET /teams/:id/recent-matches` | `teamEnhancementsController.getTeamRecentMatches` | Últimos resultados | Partidos recientes |
| `GET /teams/:id/info` | `teamEnhancementsController.getTeamInfo` | **Inverso**: 365 primero, DB fallback | Información del equipo |

Adicionalmente, 1 endpoint es **365_PRIMARY** (primero 365, DB como fallback):
- `GET /teams/:id/info`

## 2. Cambios

### 2.1 — Nueva tabla `trend_details`

**Archivo**: `database/migrations/020_trend_details.sql`

```sql
CREATE TABLE trend_details (
  trend_id INT NOT NULL PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trend_details_updated ON trend_details (updated_at DESC);
```

**Sync job**: `src/application/sync/trendsOdds.js` — nueva función `syncTrendDetails`:
- Obtiene todos los trend IDs desde `trends` que no tienen detalle o tienen `updated_at` stale (> 30 min)
- `Promise.allSettled` con `scores365.getTrendDetails(trendId)`
- `upsertMany('trend_details', ['trend_id'], rows)` (desde `syncWriters.js`)

**Registrar en scheduler**: `src/interface/scheduler/scheduler.js`
- Cada 30 min: `syncTrendDetails`

**Controller**: `dashboard/server/controllers/trendDetailController.js`
- Cambiar de `scores365.getTrendDetails(req.params.trendId)` a:
  ```js
  const { data, error } = await db.query('trend_details', {
    select: 'data',
    eq: { trend_id: trendId },
    single: true,
  });
  ```

### 2.2 — Nueva tabla para datos recientes de equipos

**Opción A (recomendada)**: 3 tablas separadas por responsabilidad.

**Archivo**: `database/migrations/021_team_data.sql`

```sql
CREATE TABLE team_recent_form (
  competitor_id INT NOT NULL PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_upcoming_matches (
  competitor_id INT NOT NULL PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_recent_results (
  competitor_id INT NOT NULL PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_form_updated ON team_recent_form (updated_at DESC);
CREATE INDEX idx_team_upcoming_updated ON team_upcoming_matches (updated_at DESC);
CREATE INDEX idx_team_results_updated ON team_recent_results (updated_at DESC);
```

**Sync jobs** (3 módulos o 1 con 3 funciones):

```js
// src/application/sync/teamState.js
async function syncTeamRecentForm(competitorId) {
  const data = await scores365.getCompetitorRecentForm(competitorId, 10);
  if (data) await upsertMany('team_recent_form', ['competitor_id'], [{ competitor_id: competitorId, data }]);
}

async function syncTeamUpcoming(competitorId) {
  const data = await scores365.getFixtures(/* usando el competitor_id como filtro */);
  if (data) await upsertMany('team_upcoming_matches', ['competitor_id'], [{ competitor_id: competitorId, data }]);
}

async function syncTeamRecentResults(competitorId) {
  const data = await scores365.getGamesCurrent(competitorId);
  if (data) await upsertMany('team_recent_results', ['competitor_id'], [{ competitor_id: competitorId, data }]);
}
```

**Estrategia de poblado**: no en scheduler (son por equipo, no globales). Se poblan **on-demand**
cuando el usuario solicita datos de un equipo (patrón CACHE_WITH_HYDRATION como el de athletes).

**Controller**: `dashboard/server/controllers/teamEnhancementsController.js`
- Los 3 endpoints pasan de ser 365_ONLY a DB_FIRST con hydrate:
  ```js
  async function getTeamRecentForm(req, res) {
    const { id } = req.params;
    const { data } = await db.query('team_recent_form', {
      select: 'data', eq: { competitor_id: id }, single: true,
    });
    if (data) return res.json({ data, source: 'db' });
    // hydrate
    const fresh = await scores365.getCompetitorRecentForm(id, 10);
    if (fresh) await db.upsert('team_recent_form', [{ competitor_id: id, data: fresh }], 'competitor_id');
    return res.json({ data: fresh, source: '365+hydrate' });
  }
  ```

### 2.3 — Invertir `GET /teams/:id/info`

**Archivo**: `dashboard/server/controllers/teamEnhancementsController.js`
- Cambiar orden: primero `db.query('competitors', { eq: { id }, select: 'data', single: true })`
- Si hay datos, devolverlos
- Si no, `scores365.getCompetitor(id)` como fallback (sin write-back, eso es Fase 4)

## 3. Tests a añadir

| Archivo | Tipo | Cubre |
|---|---|---|
| `tests/migrations/020_trend_details.test.js` | Migration | Migration aplica y backfill funciona |
| `tests/migrations/021_team_data.test.js` | Migration | Migration aplica |
| `tests/integration/trendDetails.db.test.js` | Integration | `GET /trends/details` ahora devuelve de DB |
| `tests/integration/teamEnhancements.db.test.js` | Integration | 3 endpoints de equipo devuelven de DB |
| `tests/sync/trendDetails.sync.test.js` | Unit | Sync job de trend details |

## 4. Criterio de aceptación

- [ ] `GET /trends/details` devuelve datos desde `trend_details`
- [ ] `GET /teams/:id/recent-form` devuelve datos desde `team_recent_form`
- [ ] `GET /teams/:id/upcoming` devuelve datos desde `team_upcoming_matches`
- [ ] `GET /teams/:id/recent-matches` devuelve datos desde `team_recent_results`
- [ ] `GET /teams/:id/info` prioriza DB (`competitors`) sobre 365
- [ ] Cobertura DB del dashboard = **100%** DB_ONLY o DB_FIRST
- [ ] 0 endpoints 365_ONLY/PRIMARY en routes/football.js

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Nuevas migraciones en ambiente productivo sin staging | Backup con pg_dump antes, script de rollback listo |
| Los datos on-demand pueden ser lentos en el primer request | El CACHE_WITH_HYDRATION es transparente: primero responde, luego persiste |
| `scores365.getTrendDetails` puede no devolver nada para trends viejos | El controller maneja `null/undefined` como respuesta vacía |
| Las 3 tablas de equipo pueden crecer pero cada equipo ocupa ~1-5 KB | 100 equipos × 3 tablas × 5 KB = 1.5 MB. Despreciable |
