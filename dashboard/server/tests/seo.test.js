// Tests de seoController: sitemap dinámico + botMeta para preview bots.
// Reusa el patrón de routes.test.js (mock de database/connection).

const mockQuery = jest.fn();
jest.mock('../../../database/connection', () => ({
  pool: { query: mockQuery },
  testConnection: jest.fn().mockResolvedValue(true),
  pgQueryRetry: (...args) => mockQuery(...args),
  withTransaction: (fn) => fn({ query: mockQuery }),
}));

jest.mock('../../../services/scores365Service', () => ({}));
jest.mock('../../../services/images', () => ({}));

const request = require('supertest');

const ACTIVE_COMPETITIONS_SEED = [
  {
    id: 5930, display_name: 'Mundial', short_name: 'MUN', country_id: 54,
    country_name: 'Internacional', season_num: 25, season_label: '2026',
    start_date: '2026-06-01', end_date: '2026-08-15', is_active: true,
    is_featured: true, display_order: 10, has_brackets: true, has_groups: true,
    has_history: true, config: null,
  },
];

function setupSmartMock() {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql) => {
    if (typeof sql === 'string' && sql.includes('FROM active_competitions')) {
      return Promise.resolve({ rows: ACTIVE_COMPETITIONS_SEED });
    }
    if (typeof sql === 'string' && /\bNOW\(\)/i.test(sql)) {
      return Promise.resolve({ rows: [{ now: new Date().toISOString() }] });
    }
    return Promise.resolve({ rows: [] });
  });
}

let app;
let isPreviewBot;
beforeEach(() => {
  jest.clearAllMocks();
  setupSmartMock();
  try {
    const { invalidateCompetitionCache } = require('../utils/competition');
    invalidateCompetitionCache();
  } catch (_) {}
  delete require.cache[require.resolve('../index')];
  delete require.cache[require.resolve('../controllers/seoController')];
  app = require('../index');
  ({ isPreviewBot } = require('../controllers/seoController'));
});

describe('isPreviewBot', () => {
  it('detecta bots de unfurl y no navegadores', () => {
    expect(isPreviewBot('WhatsApp/2.0')).toBe(true);
    expect(isPreviewBot('TelegramBot/1.0')).toBe(true);
    expect(isPreviewBot('Twitterbot/1.0')).toBe(true);
    expect(isPreviewBot('facebookexternalhit/1.1')).toBe(true);
    expect(isPreviewBot('Mozilla/5.0 (X11; Linux x86_64) Chrome/151')).toBe(false);
    expect(isPreviewBot('Googlebot/2.1')).toBe(false);
    expect(isPreviewBot(undefined)).toBe(false);
  });
});

describe('GET /sitemap.xml', () => {
  it('devuelve XML con home y competiciones', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch('application/xml');
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('/competicion/5930/standings');
  });
});

describe('botMeta', () => {
  it('navegador normal cae al SPA', async () => {
    const res = await request(app)
      .get('/partido/123')
      .set('User-Agent', 'Mozilla/5.0 Chrome/151');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('bot con entidad inexistente cae al SPA (no 500)', async () => {
    const res = await request(app)
      .get('/partido/999999')
      .set('User-Agent', 'WhatsApp/2.0');
    expect(res.status).toBe(200);
  });
});
