/**
 * Red de caracterización del HTTP server (Fase 7, Fase 1).
 *
 * Testea `handleRequest` (health / webhook / admin) con req/res mock, `pool` y
 * `adminAuth` mockeados. Captura el comportamiento actual antes/durante la
 * extracción desde telegramBot.js. Asserts explícitos (no snapshot) porque
 * /health incluye `uptime`/`timestamp` no deterministas.
 */

process.env.NODE_ENV = 'test';

let mockAdminEnabled = false;
let mockAdminAuthorized = false;
jest.mock('../utils/adminAuth', () => ({
  isAdminEnabled: () => mockAdminEnabled,
  requireAdmin: () => mockAdminAuthorized,
}));
jest.mock('../database/connection', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../database/connection');
const { createHttpServer } = require('../src/interface/http/server');

function mockReq({ url, method = 'GET', headers = {}, body = null }) {
  const listeners = {};
  const req = {
    url,
    method,
    headers: { host: 'localhost', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, cb) { listeners[event] = cb; return req; },
    emitBody() {
      if (body != null && listeners.data) listeners.data(body);
      if (listeners.end) listeners.end();
    },
  };
  return req;
}

function mockRes() {
  let resolveEnd;
  const res = {
    statusCode: null,
    headers: {},
    body: '',
    ended: null,
    setHeader(k, v) { res.headers[k.toLowerCase()] = v; },
    getHeader(k) { return res.headers[k.toLowerCase()]; },
    removeHeader(k) { delete res.headers[k.toLowerCase()]; },
    writeHead(status, headers) {
      res.statusCode = status;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          res.headers[k.toLowerCase()] = v;
        }
      }
      return res;
    },
    end(chunk) {
      if (chunk != null) res.body = String(chunk);
      resolveEnd();
      return res;
    },
  };
  res.ended = new Promise((r) => { resolveEnd = r; });
  return res;
}

let dbAvailable;
let webhookUpdates;
let handleRequest;

beforeEach(() => {
  mockAdminEnabled = false;
  mockAdminAuthorized = false;
  dbAvailable = false;
  webhookUpdates = [];
  pool.query.mockReset();
  ({ handleRequest } = createHttpServer({
    getDbAvailable: () => dbAvailable,
    handleWebhookUpdate: async (u) => { webhookUpdates.push(u); },
  }));
});

describe('HTTP server — health', () => {
  test('GET /health → 200 con status ok (db=demo)', async () => {
    const req = mockReq({ url: '/health' });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('ok');
    expect(json.bot).toBe('ScoreHub');
    expect(json.db).toBe('demo');
  });

  test('GET / con dbAvailable=true → db=connected', async () => {
    dbAvailable = true;
    const req = mockReq({ url: '/' });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(JSON.parse(res.body).db).toBe('connected');
  });

  test('rate limit: la request 31 devuelve 429', async () => {
    for (let i = 0; i < 30; i++) {
      const res = mockRes();
      handleRequest(mockReq({ url: '/health' }), res);
      await res.ended;
      expect(res.statusCode).toBe(200);
    }
    const res = mockRes();
    handleRequest(mockReq({ url: '/health' }), res);
    await res.ended;
    expect(res.statusCode).toBe(429);
  });
});

describe('HTTP server — webhook', () => {
  test('POST /webhook → 200 y delega el update parseado', async () => {
    const req = mockReq({ url: '/webhook', method: 'POST', body: JSON.stringify({ update_id: 7 }) });
    const res = mockRes();
    handleRequest(req, res);
    req.emitBody();
    await res.ended;
    expect(res.statusCode).toBe(200);
    expect(webhookUpdates).toEqual([{ update_id: 7 }]);
  });
});

describe('HTTP server — webhook secret (Auditoría 2026-Q3 C2)', () => {
  let originalSecret;
  let originalNodeEnv;

  beforeEach(() => {
    originalSecret = process.env.WEBHOOK_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    webhookUpdates = [];
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  test('con WEBHOOK_SECRET seteado y header correcto → 200 y procesa update', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret-1234567890';
    ({ handleRequest } = createHttpServer({
      getDbAvailable: () => false,
      handleWebhookUpdate: async (u) => { webhookUpdates.push(u); },
    }));
    const req = mockReq({
      url: '/webhook',
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'test-secret-1234567890' },
      body: JSON.stringify({ update_id: 99 }),
    });
    const res = mockRes();
    handleRequest(req, res);
    req.emitBody();
    await res.ended;
    expect(res.statusCode).toBe(200);
    expect(webhookUpdates).toEqual([{ update_id: 99 }]);
  });

  test('con WEBHOOK_SECRET seteado pero header incorrecto → 401', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret-1234567890';
    ({ handleRequest } = createHttpServer({
      getDbAvailable: () => false,
      handleWebhookUpdate: async (u) => { webhookUpdates.push(u); },
    }));
    const req = mockReq({
      url: '/webhook',
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
      body: JSON.stringify({ update_id: 99 }),
    });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(401);
    expect(webhookUpdates).toEqual([]);
  });

  test('con WEBHOOK_SECRET seteado pero sin header → 401', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret-1234567890';
    ({ handleRequest } = createHttpServer({
      getDbAvailable: () => false,
      handleWebhookUpdate: async (u) => { webhookUpdates.push(u); },
    }));
    const req = mockReq({
      url: '/webhook',
      method: 'POST',
      body: JSON.stringify({ update_id: 99 }),
    });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(401);
  });

  test('en NODE_ENV=production sin WEBHOOK_SECRET → 503 (fail-safe)', async () => {
    delete process.env.WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    ({ handleRequest } = createHttpServer({
      getDbAvailable: () => false,
      handleWebhookUpdate: async (u) => { webhookUpdates.push(u); },
    }));
    const req = mockReq({
      url: '/webhook',
      method: 'POST',
      body: JSON.stringify({ update_id: 99 }),
    });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(503);
    expect(res.body).toBe('webhook disabled');
    expect(webhookUpdates).toEqual([]);
  });

  test('en NODE_ENV=development sin WEBHOOK_SECRET → 200 (modo permisivo)', async () => {
    delete process.env.WEBHOOK_SECRET;
    process.env.NODE_ENV = 'development';
    ({ handleRequest } = createHttpServer({
      getDbAvailable: () => false,
      handleWebhookUpdate: async (u) => { webhookUpdates.push(u); },
    }));
    const req = mockReq({
      url: '/webhook',
      method: 'POST',
      body: JSON.stringify({ update_id: 42 }),
    });
    const res = mockRes();
    handleRequest(req, res);
    req.emitBody();
    await res.ended;
    expect(res.statusCode).toBe(200);
    expect(webhookUpdates).toEqual([{ update_id: 42 }]);
  });
});

describe('HTTP server — admin gates', () => {
  test('/admin con admin deshabilitado → 503', async () => {
    mockAdminEnabled = false;
    const req = mockReq({ url: '/admin' });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(503);
  });

  test('/admin habilitado pero sin auth → 401', async () => {
    mockAdminEnabled = true;
    mockAdminAuthorized = false;
    const req = mockReq({ url: '/admin' });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toMatch('Bearer');
  });

  test('/admin/api/stats autorizado → 200 con métricas', async () => {
    mockAdminEnabled = true;
    mockAdminAuthorized = true;
    pool.query.mockResolvedValue({ rows: [{ total: '5' }] });
    const req = mockReq({ url: '/admin/api/stats' });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      totalUsers: 5, totalQueries: 5, teamsFollowed: 5, todayQueries: 5,
    });
  });
});

describe('HTTP server — 404', () => {
  test('ruta desconocida → 404', async () => {
    const req = mockReq({ url: '/nope' });
    const res = mockRes();
    handleRequest(req, res);
    await res.ended;
    expect(res.statusCode).toBe(404);
  });
});
