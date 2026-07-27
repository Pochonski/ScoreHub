/**
 * Composition root (Fase 7 — Clean Architecture).
 *
 * Único lugar que conoce implementaciones concretas: instancia los adaptadores
 * de `infrastructure/` y los inyecta en los casos de uso de `application/`.
 * Los tests construyen un container con fakes; producción usa los adaptadores reales.
 *
 * VACÍO por ahora: se puebla a medida que la migración strangler mueve cada
 * comando/sync job al árbol nuevo. Ver docs/refactor-plans/07-clean-architecture-backend.md.
 */

function createContainer(/* overrides = {} */) {
  // TODO(Fase 2+): cablear gateways, repositorios y casos de uso.
  return {};
}

module.exports = { createContainer };
