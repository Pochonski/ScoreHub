# Planes de refactorización ScoreHub

Roadmap de refactorización organizado en fases independientes, ordenadas por impacto y dependencias.

## Índice

| Fase | Plan | Estado | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | [Estabilizar lo existente](./01-stabilize-current-state.md) | ✅ Cerrado | 2-3 h | Bajo |
| 2 | [Integridad de datos en sync](./02-sync-data-integrity.md) | ✅ Cerrado | 6-8 h | Medio |
| 3 | [Modelo de datos (migraciones)](./03-data-model.md) | ✅ Cerrado | 8-12 h | Alto |
| 4 | [Migración a Supabase JS (HTTP)](./04-supabase-js-migration.md) | ✅ code / ⏳ activación | 12-16 h | Medio |
| 7 | [Clean Architecture en el backend/root](./07-clean-architecture-backend.md) | ✅ Cerrado | 55-75 h | Medio |
| **8.0** | [Auditoría de cobertura DB](./08-db-coverage-fase0-auditoria.md) | **⭐ Activa** | 1-2 h | Ninguno |
| **8.1** | [Frescura y salud del sync](./09-db-frescura-y-salud.md) | Pendiente | 2-4 h | Bajo |
| **8.2** | [Predictions + tablas bot](./10-db-predictions-y-bot-tables.md) | Pendiente | 4-6 h | Medio |
| **8.3** | [Cobertura DB completa](./11-db-coverage-completa.md) | Pendiente | 6-10 h | Medio-Alto |
| **8.4** | [Write-back cache](./12-db-write-back-cache.md) | Pendiente | 4-6 h | Medio |
| **8.5** | [Activar Supabase HTTP](./13-db-activa-supabase-http.md) | Pendiente | 1-2 h | Bajo |

## Documentación permanente

| Documento | Propósito |
|---|---|
| [`docs/architecture/db-coverage.md`](../architecture/db-coverage.md) | Mapa completo de qué datos están en DB, con qué frescura, y cobertura por endpoint/comando |

## Checklist de seguimiento

Ver [CHECKLIST.md](./CHECKLIST.md) para tildar items a medida que se avanza.

## Convenciones

- Cada plan tiene: objetivo, cambios exactos con archivos/líneas, tests a añadir, criterio de aceptación y esfuerzo estimado.
- Las fases no se mezclan: cuando se abre una, se cierra antes de empezar la siguiente. Si una fase revela nueva deuda, agregar item al checklist sin expandir la fase actual.
- Las sub-fases 8.x se ejecutan en orden: 8.0 → 8.1 → 8.2 → 8.3 → 8.4 → 8.5

## Progreso esperado (Fase 8 — Cobertura DB-only)

| Hito | Resultado visible |
|---|---|
| Fin de 8.0 | Documentación de cobertura DB creada, roadmap establecido |
| Fin de 8.1 | Tablas de caché actualizadas (games < 1h, athletes < 24h, etc.) |
| Fin de 8.2 | `predictions` poblado o deshabilitado; bot tables operativas |
| Fin de 8.3 | 0 endpoints 365_ONLY; 100 % dashboard servido desde DB |
| Fin de 8.4 | Write-back automático implementado en 14 endpoints DB_FIRST |
| Fin de 8.5 | Ruta HTTP PostgREST activa; ≥80 % tráfico por HTTP |
| **Fin de Fase 8** | **Cobertura DB = 100 %; cero llamadas a 365 desde dashboard y bot** |

## Progreso esperado (Fases 1-4 legado)

| Hito | Resultado visible |
|---|---|
| Fin de Fase 1 | Cero React #310, transfer counts cuadran, live poller multi-comp, Telegram reporta errores |
| Fin de Fase 2 | Documentos canónicos ya no son sobreescritos por roster/transfer, logs JSON en Vercel |
| Fin de Fase 3 | `competition_competitors` implementado, FKs aplicadas, `bet_followers` normalizado |
| Fin de Fase 4 | Wrapper dual-strategy listo (code-complete), pendiente activar env vars |

## Causa raíz del refactor original (Fases 1-7)

DeepSeek trabajó sobre esta codebase durante varias sesiones agregando multi-comp, season archive, transfers UI, etc. Las correcciones sucesivas resolvieron síntomas sin tocar arquitectura, lo que dejó patrones sistémicos sin resolver:

1. **Upserts destructivos**: el sync escribe JSON canónicos con payloads parciales (roster, transfers, lineup), perdiendo datos completos.
2. **Relaciones many-to-many modeladas como columna escalar**: `competitors.competition_id` no puede representar correctamente la participación simultánea.
3. **Sin validación de contratos**: TypeScript confía en `apiClient.get<T>()` sin validar el payload real.
4. **Caché parcial confundida con existencia**: tablas de enriquecimiento se usan como prueba de existencia, generando falsos 404.
5. **Errores upstream ocultos**: `telegramRequest` no rechaza `ok:false`; `catch (_) {}` oculta fallos.
6. **Workaround de conexiones**: `pool.max=2` arregló `EMAXCONNSESSION` parcialmente.

Las fases 1-7 atacaron cada uno de estos puntos. La **Fase 8** (DB Coverage) es un nuevo ciclo que ataca el objetivo estratégico de **operación DB-only**.
