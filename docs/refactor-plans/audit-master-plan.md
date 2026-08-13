# Plan de hardening ScoreHub (post-auditoría Q3 2026)

Roadmap de remediación derivado de la auditoría exhaustiva del proyecto (commit `270f32c`). Cada fase es **autónoma, committable y reversible**, y se ejecuta en orden de impacto decreciente.

> Ver informe completo de auditoría en [`AUDIT-2026-Q3.md`](./AUDIT-2026-Q3.md) — incluye los 38 hallazgos, evidencia con file:line, causa raíz estructural y métricas.
>
> Checklist operacional: [`audit-checklist.md`](./audit-checklist.md) — tildar items a medida que se avanza.

## Convenciones

- **Numeración `phase-NN-…`** — fuera de la serie existente 1–8 (DB coverage). Empieza en `00` para esta nueva serie.
- **Cada plan tiene:** objetivo, alcance (archivos + líneas), cambios exactos, criterios de aceptación, tests a añadir, esfuerzo, riesgo y rollback.
- **No se mezclan fases**: cuando una fase revela nueva deuda, se agrega item al checklist, no se expande la fase actual.
- **Branch por fase**: `hardening/phase-NN-*`. Un PR por fase. Merge a `master` después de CI verde.

## Índice de fases

| # | Plan | Estado | Esfuerzo | Riesgo | Bloquea deploy |
|---|---|---|---|---|---|
| **0** | [Seguridad crítica (XSS admin + webhook secret)](./phase-00-critical-security.md) | ✅ Cerrado (2026-08-11) | 3-4 h | Bajo | **Sí** |
| **1** | [Hardening de seguridad media](./phase-01-security-hardening.md) | ✅ Cerrado (2026-08-11) | 4-6 h | Bajo | **Sí** |
| **2** | [Race conditions y correctness](./phase-02-race-conditions.md) | ✅ Cerrado (2026-08-11) | 2-3 h | Bajo | Recomendado |
| **3** | [Arquitectura: ports tipados + sync gateado](./phase-03-architecture-ports-sync.md) | ✅ Cerrado (2026-08-11) | 4-5 h | Medio | No |
| **4** | [Consolidación de config + logger](./phase-04-config-logger.md) | ✅ Cerrado (2026-08-11) | 3-4 h | Medio | No |
| **5** | [Limpieza de anti-patterns](./phase-05-antipatterns-cleanup.md) | ✅ Cerrado (2026-08-11) | 2-3 h | Bajo | No |
| **6** | [DB cleanup + migración 025](./phase-06-db-cleanup.md) | ✅ Cerrado (2026-08-11) | 2 h | Medio | No |
| **7** | [Frontend hardening](./phase-07-frontend-hardening.md) | ✅ Cerrado (2026-08-11) | 2-3 h | Bajo | No |
| **8** | [Cobertura de tests críticos](./phase-08-test-coverage.md) | ✅ Cerrado (2026-08-11) | 4-5 h | Bajo | No |
| **9** | [Admin panel profesional](./phase-09-admin-panel.md) | ✅ Cerrado (2026-08-11) | 1-2 h | Bajo | No |
| **10** | [Limpieza final](./phase-10-final-cleanup.md) | ✅ Cerrado (2026-08-11) | 30 min | Mínimo | No |
| **11** | [Documentación](./phase-11-documentation.md) | ✅ Cerrado (2026-08-11) | 1 h | Mínimo | No |
| **12** | [Migración del legacy pendiente](./phase-12-legacy-migration.md) | ✅ Cerrado (2026-08-11, parcial) | 30 min | Bajo | No |

**Total estimado:** ~45-60 horas, distribuidas en 13 PRs.

## Hitos visibles

| Hito | Resultado |
|---|---|
| Fin de Fase 0 | Cero XSS explotable en admin; webhook con autenticación por secret |
| Fin de Fase 1 | Helmet + rate limit + SRI + sin PII crudo en `/api/queries` |
| Fin de Fase 2 | `readThrough` race condition cerrada; CORS configurable |
| Fin de Fase 3 | Ports tipados con duck-type enforcement; sync usa gateway nuevo |
| Fin de Fase 4 | Config unificada; cero `console.*` en `src/`; una sola llamada a `dotenv.config` |
| Fin de Fase 5 | `flushSync` conectado a SIGTERM; un solo `isRunning`; SQL extraído del handler |
| Fin de Fase 6 | `bet_followers` v1 dropeada; `migrate.js` con `pg_advisory_lock`; schema.sql marcada como histórica |
| Fin de Fase 7 | CSP activo; logger cliente off en prod; cache LRU |
| Fin de Fase 8 | Thresholds Jest activos; tests de `assertIdent`, `adminAuth`, `processGuard`, container |
| Fin de Fase 9 | Audit log en admin; `ADMIN_TOKEN` mínimo 32 chars |
| Fin de Fase 10 | Scripts redundantes borrados; `.env.bak` purgado |
| Fin de Fase 11 | `docs/security.md` + env-vars actualizado + arquitectura sincronizada |
| Fin de Fase 12 | `processMessage` casos especiales migrados al router; `console.*` en handlers reemplazado |

## Orden de ejecución

```
PR #0  ──→ PR #1  ──→ PR #2  ──→ PR #6 (migración 025, independiente)
   │         │         │
   │         │         └─→ PR #3 (arquitectura)
   │         │
   │         └─→ PR #4 (config + logger)
   │
   └─→ PR #5 (cleanup), PR #7 (frontend), PR #8 (tests), PR #9 (admin),
       PR #10 (limpieza), PR #11 (docs), PR #12 (legacy)
```

**Fases 0–1 son bloqueantes para deploy** (regresiones de seguridad activas).
**Fase 2 es altamente recomendada** (race condition detectable bajo carga).
**Fases 3–12 son mejoras incrementales** mergeables en paralelo si hay bandwidth.

## Causa raíz que motiva este ciclo

La auditoría Q3 2026 (commit `270f32c`) identificó **38 hallazgos** distribuidos en:

- 2 vulnerabilidades activas (XSS admin, webhook sin firma)
- 1 race condition (`readThrough` cache)
- 6 huecos de seguridad media (rate limit, helmet, SRI, PII, LIKE escape, CORS hardcodeado)
- 8 anti-patterns de arquitectura (ports vacíos, sync que bypassa gateway, config dispersa, logger inconsistente)
- 12 gaps de tests en código crítico de seguridad
- 9 items de limpieza / DX / docs

Este ciclo es complementario a las Fases 1-8 (DB coverage), no las reemplaza. La serie anterior sigue activa (8.1-8.5 pendientes) y debe coordinarse con esta.

## Estado final del ciclo

**80/80 items cerrados** (100%). Detalle en [`audit-checklist.md`](./audit-checklist.md).

| Suite | Tests | Cobertura clave |
|---|---|---|
| Backend root (Jest) | 263 ✓ | adminAuth 91%, jobGuard 100%, processGuard 100%, db.js 41% |
| Dashboard (Vitest) | 137 ✓ | useGameDetail con partialError, hooks con TanStack Query |
| Admin (Jest) | 13 ✓ | 13 endpoints, helmet, rate limit, PII redaction |
| **Total** | **413 ✓** | |

3 fallas pre-existentes (sync.freshness con datos reales DB) — fuera del scope.

## Branching strategy

```
master
  ├── hardening/phase-00-critical-security        ← PR #0
  ├── hardening/phase-01-security-hardening       ← PR #1
  ├── hardening/phase-02-race-conditions          ← PR #2
  ├── hardening/phase-03-architecture             ← PR #3
  └── ...
```

Cada PR incluye:
1. Cambios de código del scope definido.
2. Tests nuevos (cuando aplique).
3. Actualización del checklist en este directorio.
4. Link al plan de la fase en la descripción del PR.

## Verificación al cierre de cada fase

- [ ] CI verde (`npm test` + `cd dashboard && npm test`).
- [ ] Lint limpio (dashboard tiene ESLint configurado).
- [ ] Plan de fase actualizado a ✅ Cerrado.
- [ ] Tabla de progreso en este README actualizada.
- [ ] Sin secrets en el diff (`git diff --stat` no incluye `.env*`).