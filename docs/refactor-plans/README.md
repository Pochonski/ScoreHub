# Plan de Refactorización ScoreHub

Roadmap en 4 fases para enderezar la deuda técnica que DeepSeek introdujo al expandir la base. Cada fase es independiente, pero están ordenadas por impacto y dependencias.

## Índice

| Fase | Plan | Estado | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | [Estabilizar lo existente](./01-stabilize-current-state.md) | ✅ Cerrado | 2-3 h | Bajo |
| 2 | [Integridad de datos en sync](./02-sync-data-integrity.md) | ✅ Cerrado | 6-8 h | Medio |
| 3 | [Modelo de datos (migraciones)](./03-data-model.md) | ✅ Cerrado | 8-12 h | Alto (migraciones) |
| 4 | [Migración a Supabase JS (HTTP)](./04-supabase-js-migration.md) | ✅ code / ⏳ activación | 12-16 h | Medio |
| 7 | [Clean Architecture en el backend/root](./07-clean-architecture-backend.md) | Pendiente | 55-75 h | Medio (incremental) |

## Checklist de seguimiento

Ver [CHECKLIST.md](./CHECKLIST.md) para tildar items a medida que se avanza.

## Convenciones

- Cada plan tiene: objetivo, cambios exactos con archivos/líneas, tests a añadir, criterio de aceptación y esfuerzo estimado.
- Antes de tocar Fase 3 (migraciones) hay que validar las Fases 1 y 2 contra el usuario.
- Antes de tocar Fase 4 se recomienda hacer staging DB.
- Las fases no se mezclan: cuando se abre una, se cierra antes de empezar la siguiente. Si una fase revela nueva deuda, agregar item al checklist sin expandir la fase actual.

## Progreso esperado

| Hito | Resultado visible |
|---|---|
| Fin de Fase 1 | Cero React #310, transfer counts cuadran, live poller multi-comp, Telegram reporta errores |
| Fin de Fase 2 | Documentos canónicos ya no son sobreescritos por roster/transfer, logs JSON en Vercel |
| Fin de Fase 3 | `competitors.competition_id` reemplazado, FKs aplicadas, `bet_followers` normalizado |
| Fin de Fase 4 | Cero `EMAXCONNSESSION` con alta concurrencia en Vercel |

## Causa raíz del refactor

DeepSeek trabajó sobre esta codebase durante varias sesiones agregando multi-comp, season archive, transfers UI, etc. Las correcciones sucesivas resolvieron síntomas sin tocar arquitectura, lo que dejó patrones sistémicos sin resolver:

1. **Upserts destructivos**: el sync escribe JSON canónicos con payloads parciales (roster, transfers, lineup), perdiendo datos completos.
2. **Relaciones many-to-many modeladas como columna escalar**: `competitors.competition_id` no puede representar correctamente la participación simultánea.
3. **Sin validación de contratos**: TypeScript confía en `apiClient.get<T>()` sin validar el payload real. Causa de crashes recurrentes.
4. **Caché parcial confundida con existencia**: tablas de enriquecimiento (overviews, h2h, etc.) se usan como prueba de existencia, generando falsos 404.
5. **Errores upstream ocultos**: `telegramRequest` no rechaza `ok:false`; muchos `catch (_) {}` en syncs y handlers hacen indistinguible dato vacío legítimo de DB caída.
6. **Workaround de conexiones**: `pool.max=2` arregló `EMAXCONNSESSION` parcialmente, pero la causa real es la arquitectura de serverless vs pool persistente.

Las 4 fases atacan cada uno de estos puntos en orden de impacto al usuario final.
