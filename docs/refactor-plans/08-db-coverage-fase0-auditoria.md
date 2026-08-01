# Fase 8 — Auditoría de cobertura DB (Fase 0 del plan)

> **Objetivo**: cristalizar en documentación el análisis completo de cobertura DB vs 365scores,
> y establecer el roadmap para alcanzar DB-only. **No toca código de aplicación.**

**Esfuerzo**: 1-2 horas · **Riesgo**: Ninguno (solo documentación) · **Estado**: ⏳ Pendiente

---

## 1. Diagnóstico

El proyecto no tiene documentación centralizada que describa qué datos están o no en DB,
con qué frescura, ni qué endpoints del dashboard o comandos del bot recurren a 365scores.
Esta falta de mapa impide:

- Saber si un endpoint nuevo requiere sync previo
- Diagnosticar por qué la UI muestra datos stale
- Decidir qué priorizar para alcanzar operación DB-only

Se realizó un análisis completo contra Supabase (pg_stat_user_tables, freshness) y contra
el código (42 endpoints dashboard + ~35 comandos bot). Los hallazgos están listos.

## 2. Cambios

| Archivo | Acción |
|---|---|
| `docs/architecture/db-coverage.md` | Crear (documento permanente de cobertura) |
| `docs/refactor-plans/09-db-frescura-y-salud.md` | Crear |
| `docs/refactor-plans/10-db-predictions-y-bot-tables.md` | Crear |
| `docs/refactor-plans/11-db-coverage-completa.md` | Crear |
| `docs/refactor-plans/12-db-write-back-cache.md` | Crear |
| `docs/refactor-plans/13-db-activa-supabase-http.md` | Crear |
| `docs/refactor-plans/CHECKLIST.md` | Actualizar — añadir sección Fase 8 |
| `docs/refactor-plans/README.md` | Actualizar — añadir Fase 8 al índice |

Ningún archivo de código de aplicación se modifica.

## 3. Tests a añadir

Ninguno (solo documentación).

## 4. Criterio de aceptación

- [ ] `docs/architecture/db-coverage.md` existe y describe:
  - Estado de conexión (pg-only)
  - Esquema completo (36 tablas, 18 migraciones)
  - Freshness por tabla
  - Mapa de cobertura dashboard (42 endpoints clasificados)
  - Mapa de cobertura bot (~35 comandos clasificados)
  - 5 gaps priorizados
- [ ] 6 planes de refactor (09-13) creados
- [ ] `CHECKLIST.md` y `README.md` actualizados
- [ ] `git diff --stat` solo muestra archivos `.md`
