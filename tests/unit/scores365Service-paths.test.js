/**
 * tests/unit/scores365Service-paths.test.js — Fase 8.6
 *
 * Verifica que los paths de los endpoints de la API 365scores en
 * `scores365Service.js` están bien construidos (incluyen slash final
 * cuando es requerido por el upstream).
 *
 * Estrategia: análisis estático del source. Verifica que ningún path
 * tenga el patrón `/web/X` sin `/` final cuando el endpoint upstream
 * lo requiere.
 *
 * Referencia del bug: `getGamePreStats` usaba `/web/stats/preGame`
 * (sin slash) lo que causaba HTTP 500 en el upstream. Fixed en Fase 8.6.
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');

const SERVICE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'services',
  'scores365Service.js'
);

describe('scores365Service — endpoints con slash final (Fase 8.6 regression)', () => {
  let source;
  let apiMethods;

  beforeAll(() => {
    source = fs.readFileSync(SERVICE_PATH, 'utf8');
    apiMethods = require('../../services/scores365Service');
  });

  test('archivo fuente existe y es legible', () => {
    expect(source.length).toBeGreaterThan(1000);
  });

  test('getGamePreStats usa path con slash final (bug Fase 8.6)', () => {
    // El bug crítico: el path original era `/web/stats/preGame` sin
    // slash, lo que causaba HTTP 500 en upstream. Fixed en Fase 8.6.
    expect(source).toContain("/web/stats/preGame/");
    expect(source).not.toMatch(/getGamePreStats[^,]*get\('\/web\/stats\/preGame'/);
  });

  test('getAthleteNextGame usa path con slash final', () => {
    expect(source).toContain('/web/athletes/nextGame/');
  });

  test('getAthleteChartEvents usa path con slash final', () => {
    expect(source).toContain('/web/athletes/chartEvents/');
  });

  test('getCompetitorRecentForm usa path con slash final', () => {
    expect(source).toContain('/web/competitors/recentForm/');
  });

  test('getGameLineups usa path con slash final', () => {
    expect(source).toContain('/web/athletes/games/lineups/');
  });

  test('métodos públicos disponibles', () => {
    expect(typeof apiMethods.getGamePreStats).toBe('function');
    expect(typeof apiMethods.getGameOverview).toBe('function');
    expect(typeof apiMethods.getGamesCurrent).toBe('function');
  });
});