/**
 * Jest del root (Fase 7). Corre los golden-master del bot y del sync.
 * El dashboard tiene su propio Jest (dashboard/ y dashboard/server/), por eso
 * se ignora acá: este runner solo mira `tests/` del root.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dashboard/'],
  clearMocks: true,
};
