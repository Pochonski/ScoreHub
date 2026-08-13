'use strict';

/**
 * Tests del newsImageProxyController.
 * Auditoría 2026-Q3 post-deploy: las imágenes de news vienen de hosts
 * externos; el proxy valida allowlist antes de fetchar.
 *
 * v2: Allowlist usa SLD+1 matching para cubrir subdominios sin
 * enumerar cada `estaticos.X.com`, `objetos.estaticos-X.com`, etc.
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

describe('newsImageProxyController — isAllowedHost', () => {
  let originalFetch;
  let proxyNewsImage;
  let isAllowedHost;
  let ALLOWED_DOMAINS;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    ({
      proxyNewsImage,
      isAllowedHost,
      ALLOWED_DOMAINS,
    } = require('../controllers/newsImageProxyController'));
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

  test('rechaza http:// (no https)', async () => {
    const req = { query: { url: 'http://www.365scores.com/img.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rechaza host fuera de allowlist (con log de diagnóstico)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const req = { query: { url: 'https://evil.com/img.jpg' } };
    const res = mockRes();
    await proxyNewsImage(req, res);
    expect(res.statusCode).toBe(403);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('blocked host: evil.com')
    );
    warnSpy.mockRestore();
  });

  test('fetch upstream si host está en allowlist', async () => {
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
});

describe('isAllowedHost — SLD+1 matching', () => {
  let isAllowedHost;
  let ALLOWED_DOMAINS;

  beforeAll(() => {
    ({ isAllowedHost, ALLOWED_DOMAINS } = require('../controllers/newsImageProxyController'));
  });

  test('acepta dominio exacto en allowlist', () => {
    expect(isAllowedHost('marca.com')).toBe(true);
    expect(isAllowedHost('365scores.com')).toBe(true);
  });

  test('acepta subdomain directo', () => {
    expect(isAllowedHost('www.365scores.com')).toBe(true);
    expect(isAllowedHost('estaticos.marca.com')).toBe(true);
  });

  test('acepta subdominios nested (estaticos, objetos, static)', () => {
    expect(isAllowedHost('objetos.estaticos-marca.com')).toBe(true);
    expect(isAllowedHost('estaticos.as.com')).toBe(true);
    expect(isAllowedHost('estaticos.epimg.es')).toBe(true);
  });

  test('rechaza dominio no registrado', () => {
    expect(isAllowedHost('evil.com')).toBe(false);
    expect(isAllowedHost('random-site.org')).toBe(false);
  });

  test('rechaza ataques tipo "365scores.com.evil.com"', () => {
    // endsWith('.365scores.com') requiere que TERMINÉ en 365scores.com,
    // no que contenga la substring.
    expect(isAllowedHost('365scores.com.evil.com')).toBe(false);
    expect(isAllowedHost('evil-365scores.com')).toBe(false);
  });

  test('ALLOWED_DOMAINS contiene los periódicos españoles esperados', () => {
    expect(ALLOWED_DOMAINS).toContain('365scores.com');
    expect(ALLOWED_DOMAINS).toContain('marca.com');
    expect(ALLOWED_DOMAINS).toContain('as.com');
    expect(ALLOWED_DOMAINS).toContain('epimg.es');
    expect(ALLOWED_DOMAINS).toContain('elmundo.es');
  });
});