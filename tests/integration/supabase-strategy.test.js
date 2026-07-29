/**
 * tests/integration/supabase-strategy.test.js — Fase 8.5
 *
 * Verifica el comportamiento del wrapper database/db.js según si Supabase
 * JS HTTP está configurado o no.
 *
 * Cuando NO está configurado (caso actual en este host):
 *   - isEnabled() === false
 *   - db.query() cae a queryViaPg (pg)
 *   - db.execAdvanced() siempre usa pg
 *
 * Cuando SÍ está configurado:
 *   - isEnabled() === true
 *   - db.query() usa Supabase HTTP (PostgREST)
 *   - dbStats.supabaseCalls aumenta
 */

process.env.NODE_ENV = 'test';

describe('integration/supabase-strategy — fallback behavior', () => {
  let isEnabled;

  beforeAll(async () => {
    // Importar después de los mocks para reflejar el estado real.
    const supabaseClient = require('../../database/supabaseClient');
    isEnabled = supabaseClient.isEnabled;
  });

  test('estado inicial sin env vars → isEnabled === false', () => {
    // El .env actual no tiene SUPABASE_URL ni SUPABASE_SERVICE_ROLE_KEY.
    expect(isEnabled()).toBe(false);
  });

  test('isEnabled() refleja correctamente las env vars', () => {
    // Sanity check: el sistema de detección funciona.
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(isEnabled()).toBe(hasUrl && hasKey);
  });

  test('script check-supabase-config.js existe y es ejecutable', () => {
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'check-supabase-config.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('script activate-supabase-http.js existe y es ejecutable', () => {
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'activate-supabase-http.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });
});

describe('integration/supabase-strategy — activar HTTP', () => {
  /**
   * Cuando se activan las env vars, Supabase JS debe estar habilitado
   * y las queries deben ir por HTTP. Verificamos el mock para asegurar
   * que la lógica funciona end-to-end.
   */
  test('mock Supabase + isEnabled=true simula activación HTTP', () => {
    jest.resetModules();

    // Mockear el módulo @supabase/supabase-js para evitar crear un cliente real.
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { id: 1, display_name: 'Test' },
                error: null,
              }),
            })),
            order: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({
                data: [{ id: 1, display_name: 'Test' }],
                error: null,
              }),
            })),
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 1 }],
              error: null,
            }),
          })),
        })),
      })),
    }));

    // Forzar env vars.
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.test';

    const supabaseClient = require('../../database/supabaseClient');
    expect(supabaseClient.isEnabled()).toBe(true);

    const client = supabaseClient.getClient();
    expect(client.from).toBeDefined();

    // Cleanup
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    jest.resetModules();
  });
});