/**
 * admin/tests/server.test.js — Auditoría 2026-Q3 Fase 8.7
 *
 * Tests del panel admin: auth gates, endpoints, rate limit, y los cambios
 * de Fase 1 (limit clamp, PII redaction en /api/queries).
 *
 * Setup: ADMIN_TOKEN en env antes de cargar server.js. DB mockeada.
 * Se usa http.createServer directamente (no supertest para no requerir deps extra).
 */

process.env.NODE_ENV = 'test';
// Fase 9.2: ADMIN_TOKEN ≥ 32 chars para pasar el gate de adminAuth.
process.env.ADMIN_TOKEN = 'testadmintoken12345678901234567890xx'; // 34 chars
process.env.ADMIN_STANDALONE = 'false';

// Mockear el módulo DB antes de requerir server.js.
// IMPORTANTE: regex con flag 's' (dotAll) para que .* matchee newlines,
// porque el SQL generado tiene múltiples líneas.
jest.mock('../../database/connection', () => ({
  pool: {
    query: jest.fn().mockImplementation((sql) => {
      if (/COUNT.*usuarios/s.test(sql)) return Promise.resolve({ rows: [{ total: '42' }] });
      if (/COUNT.*historial_consultas/s.test(sql)) return Promise.resolve({ rows: [{ total: '100' }] });
      if (/COUNT.*equipos_seguidos/s.test(sql)) return Promise.resolve({ rows: [{ total: '8' }] });
      if (/SELECT.*usuarios.*alias.*fecha_registro/s.test(sql)) {
        return Promise.resolve({ rows: [{ id: 'u1', alias: 'test', fecha_registro: new Date() }] });
      }
      if (/SELECT.*historial_consultas.*JOIN/s.test(sql)) {
        // Distinguir ?expand=1 (LEFT respuesta) vs default (NULL::text).
        const hasExpand = /LEFT\(h\.respuesta/s.test(sql);
        const row = {
          id: 1,
          consulta: 'foo',
          respuesta: hasExpand ? 'mock-response' : null,
          tipo: 'live',
          fecha: new Date(),
          alias: 'test',
        };
        return Promise.resolve({ rows: [row] });
      }
      if (/SELECT.*equipos_seguidos.*JOIN/s.test(sql)) {
        return Promise.resolve({ rows: [{ nombre_equipo: 'Brasil', alias: 'test', fecha_seguimiento: new Date() }] });
      }
      if (/GROUP BY tipo/s.test(sql)) {
        return Promise.resolve({ rows: [{ tipo: 'live', total: '50' }, { tipo: 'fixture', total: '30' }] });
      }
      return Promise.resolve({ rows: [] });
    }),
  },
}));

const http = require('http');

function makeRequest(server, options = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('admin/server — auth gates', () => {
  let app;
  let server;

  beforeAll((done) => {
    delete require.cache[require.resolve('../server')];
    app = require('../server');
    server = http.createServer(app);
    server.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  test('GET /api/stats sin auth → 401', async () => {
    const res = await makeRequest(server, { path: '/api/stats' });
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/stats con Bearer correcto → 200 con métricas', async () => {
    const res = await makeRequest(server, {
      path: '/api/stats',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json.totalUsers).toBe(42);
    expect(res.json.totalQueries).toBe(100);
    expect(res.json.teamsFollowed).toBe(8);
  });

  test('GET /api/users con auth → 200 con array', async () => {
    const res = await makeRequest(server, {
      path: '/api/users',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });

  test('GET /api/queries sin ?full → respuesta null (redaction)', async () => {
    const res = await makeRequest(server, {
      path: '/api/queries',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json[0]).toHaveProperty('consulta');
    expect(res.json[0].respuesta).toBeNull();
  });

  test('GET /api/queries con ?expand=1 → respuesta presente', async () => {
    const res = await makeRequest(server, {
      path: '/api/queries?expand=1',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json[0]).toHaveProperty('respuesta');
  });

  test('GET /api/queries?limit=999999 responde sin crashear', async () => {
    const res = await makeRequest(server, {
      path: '/api/queries?limit=999999',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/queries?limit=0 responde OK (clamp a 1)', async () => {
    const res = await makeRequest(server, {
      path: '/api/queries?limit=0',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/queries-by-type → 200 con array', async () => {
    const res = await makeRequest(server, {
      path: '/api/queries-by-type',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });

  test('GET /api/followed-teams → 200', async () => {
    const res = await makeRequest(server, {
      path: '/api/followed-teams',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });

  test('OPTIONS preflight pasa sin auth', async () => {
    const res = await makeRequest(server, {
      path: '/api/stats',
      method: 'OPTIONS',
    });
    expect([200, 204]).toContain(res.statusCode);
  });

  test('security headers de helmet presentes', async () => {
    const res = await makeRequest(server, {
      path: '/api/stats',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('Bearer header mal formado → 401', async () => {
    const res = await makeRequest(server, {
      path: '/api/stats',
      headers: { authorization: 'Bearer wrongtoken' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('admin/server — admin deshabilitado', () => {
  let app;
  let server;

  beforeAll((done) => {
    jest.resetModules();
    delete process.env.ADMIN_TOKEN;
    jest.doMock('../../database/connection', () => ({
      pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
    }));
    app = require('../server');
    server = http.createServer(app);
    server.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
    process.env.ADMIN_TOKEN = 'testadmintoken12345678901234567890xx';
  });

  test('sin ADMIN_TOKEN → 503', async () => {
    const res = await makeRequest(server, { path: '/api/stats' });
    expect(res.statusCode).toBe(503);
    expect(res.json.error).toMatch(/ADMIN_TOKEN/);
  });
});