'use strict';

/**
 * Tests del newsImageProxyController.
 * Auditoría 2026-Q3 post-deploy: las imágenes de news vienen de hosts
 * externos; el proxy valida allowlist antes de fetchar.
 */

// El controller usa fetch global (Node 18+). Lo mockeamos via globalThis.
const mockFetch = jest.fn();

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: '',
    ended: false,
    status(c) { this.statusCode = c; return this; },
    set(k, v) { this.headers[k] = v; return this; },
    writeHead(c, h) {
      this.statusCode = c;
      if (h) Object.assign(this.headers, h);
      return this;
    },
    write(c) { this.body += c.toString(); return true; },
    end() { this.ended = true; },
    json(o) { this.body = JSON.stringify(o); this.headers['Content-Type'] = 'application/json'; },
  };
  return res;
}

describe('newsImageProxyController', () => {
  let originalFetch;
  let proxyNewsImage;
  let ALLOWED_HOSTS;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    // Requerir el controller DESPUÉS de mockear fetch.
    ({ proxyNewsImage, ALLOWED_HOSTS } = require('../controllers/newsImageProxyController'));
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('rechaza sin param url', async () => {
    const req = { query: {} };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rechaza url no http/https', async () => {
    const req = { query: { url: 'ftp://example.com/img.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rechaza host fuera de allowlist', async () => {
    const req = { query: { url: 'https://evil.com/img.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(403);
  });

  test('rechaza http:// (no https)', async () => {
    const req = { query: { url: 'http://www.365scores.com/img.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('fetch upstream si host está en allowlist', async () => {
    // Body como ReadableStream real (Node 18+) con getReader().
    const chunks = [Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('jpeg data')];
    let i = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (i < chunks.length) {
          controller.enqueue(chunks[i++]);
        } else {
          controller.close();
        }
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'image/jpeg']]),
      body: stream,
    });

    const req = { query: { url: 'https://www.365scores.com/img.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.365scores.com/img.jpg',
      expect.objectContaining({ redirect: 'follow' })
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/jpeg');
  });

  test('devuelve 502 si upstream retorna 5xx', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 500, headers: new Map(), body: null,
    });
    const req = { query: { url: 'https://objetos.estaticos-marca.com/x.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(502);
  });

  test('devuelve 404 si upstream retorna 4xx', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 404, headers: new Map(), body: null,
    });
    const req = { query: { url: 'https://objetos.estaticos-marca.com/x.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(404);
  });

  test('ALLOWED_HOSTS contiene los hosts esperados', () => {
    expect(ALLOWED_HOSTS.has('www.365scores.com')).toBe(true);
    expect(ALLOWED_HOSTS.has('objetos.estaticos-marca.com')).toBe(true);
    expect(ALLOWED_HOSTS.has('imagecache.365scores.com')).toBe(true);
    expect(ALLOWED_HOSTS.has('evil.com')).toBe(false);
  });
});