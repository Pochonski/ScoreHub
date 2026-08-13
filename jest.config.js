/**
 * Jest del root (Fase 7). Corre los golden-master del bot y del sync.
 * El dashboard tiene su propio Jest (dashboard/ y dashboard/server/), por eso
 * se ignora acá: este runner solo mira `tests/` del root.
 *
 * Auditoría 2026-Q3 Fase 8.8: coverage thresholds activos. Objetivos realistas
 * para evitar regresiones silenciosas en código crítico de seguridad/utils/DB.
 * El legacy (handlers/, services/) tiene umbrales más bajos porque está en
 * strangler y se migra gradualmente.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dashboard/', '/admin/'],
  clearMocks: true,
  collectCoverageFrom: [
    'utils/**/*.js',
    'database/**/*.js',
    'src/**/*.js',
    'services/**/*.js',
    'handlers/**/*.js',
    '!**/node_modules/**',
    '!**/*.test.js',
  ],
  coverageThreshold: {
    // Objetivos globales modestos; los archivos críticos tienen goals más altos.
    // Subir gradualmente a medida que se agregan tests.
    global: { branches: 8, functions: 28, lines: 22, statements: 22 },
    // Código security-critical cubierto por tests Fase 8.
    './utils/adminAuth.js': { branches: 75, functions: 90, lines: 85, statements: 85 },
    './utils/jobGuard.js': { branches: 80, functions: 90, lines: 90, statements: 90 },
    './utils/processGuard.js': { branches: 60, functions: 90, lines: 90, statements: 90 },
    // logger.js: consoleShim no es fácil ejercitar sin mockear require('pino').
    // Threshold en 40% — subir cuando agreguemos tests que cubran el fallback.
    './utils/logger.js': { branches: 25, functions: 15, lines: 45, statements: 40 },
    // database/db.js es demasiado grande para 50% — sólo `assertIdent`/`assertSelectList`
    // y `readThrough` están probados. Subir a 35% documenta la dirección.
    './database/db.js': { branches: 30, functions: 40, lines: 35, statements: 35 },
    // connection.js y migrate.js no tienen tests dedicados todavía; sin threshold
    // hasta que se agreguen. Ver Fase 8.1 backlog.
  },
};